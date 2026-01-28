import type { ExcelData, ColumnMapping, SqlConfig, ValidationError } from '@/types/converter';
import { getAdapter } from './adapters';
import { getBangkokTimestamp } from './timezone';

function escapeString(value: string, trim: boolean, database: string): string {
  let escaped = trim ? value.trim() : value;

  if (database === 'mysql') {
    // MySQL: escape backslashes and single quotes
    escaped = escaped.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  } else {
    // PostgreSQL: double single quotes
    escaped = escaped.replace(/'/g, "''");
  }

  return `'${escaped}'`;
}

function formatValue(
  value: any,
  mapping: ColumnMapping,
  config: SqlConfig
): string {
  const database = config.database || 'postgresql';

  if (value === null || value === undefined || value === '') {
    if (config.options.ignoreNullValues && !mapping.isPrimaryKey) {
      return 'NULL';
    }
    return mapping.defaultValue ? `'${mapping.defaultValue}'` : 'NULL';
  }

  const strValue = String(value);

  switch (mapping.dataType) {
    case 'INTEGER':
    case 'BIGINT':
      if (config.options.castTypes && database === 'postgresql') {
        return `${parseInt(strValue, 10)}::${mapping.dataType}`;
      }
      return String(parseInt(strValue, 10));

    case 'DECIMAL':
      if (config.options.castTypes && database === 'postgresql') {
        return `${parseFloat(strValue)}::DECIMAL`;
      }
      return String(parseFloat(strValue));

    case 'BOOLEAN':
      const boolVal = ['true', '1', 'yes'].includes(strValue.toLowerCase());
      if (database === 'mysql') {
        return boolVal ? '1' : '0';
      }
      return boolVal ? 'TRUE' : 'FALSE';

    case 'JSON':
    case 'JSONB':
      if (config.options.castTypes && database === 'postgresql') {
        return `${escapeString(strValue, config.options.trimStrings, database)}::${mapping.dataType}`;
      }
      return escapeString(strValue, config.options.trimStrings, database);

    case 'UUID':
      if (config.options.castTypes && database === 'postgresql') {
        return `${escapeString(strValue, config.options.trimStrings, database)}::UUID`;
      }
      return escapeString(strValue, config.options.trimStrings, database);

    case 'DATE':
    case 'TIMESTAMP':
    case 'TIMESTAMPTZ':
      if (config.options.castTypes && database === 'postgresql') {
        return `${escapeString(strValue, config.options.trimStrings, database)}::${mapping.dataType}`;
      }
      return escapeString(strValue, config.options.trimStrings, database);

    default:
      return escapeString(strValue, config.options.trimStrings, database);
  }
}

export function generateSQL(
  data: ExcelData,
  mappings: ColumnMapping[],
  config: SqlConfig
): { sql: string; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const statements: string[] = [];
  const database = config.database || 'postgresql';
  const adapter = getAdapter(database);

  // Transaction start
  if (config.options.wrapInTransaction) {
    statements.push(adapter.beginTransaction());
    statements.push('');
  }

  const activeMappings = mappings.filter(m => m.pgColumn);
  const pkMapping = activeMappings.find(m => m.isPrimaryKey);

  // Validate UPDATE mode requires primary key
  if (config.mode === 'UPDATE' && !pkMapping) {
    errors.push({
      row: 0,
      column: '',
      message: 'UPDATE mode requires a primary key column to be selected',
      severity: 'error',
    });
  }

  const columnNames = activeMappings.map(m => m.pgColumn);
  const batches: string[][] = [];
  let currentBatch: string[] = [];

  for (let rowIndex = 0; rowIndex < data.rows.length; rowIndex++) {
    const row = data.rows[rowIndex];
    const values: string[] = [];

    for (const mapping of activeMappings) {
      const colIndex = data.headers.indexOf(mapping.excelColumn);
      const value = colIndex >= 0 ? row[colIndex] : null;

      // Validation
      if (!mapping.isNullable && (value === null || value === undefined || value === '')) {
        errors.push({
          row: rowIndex + 2, // +2 for header and 0-index
          column: mapping.excelColumn,
          message: `Required value missing for column "${mapping.pgColumn}"`,
          severity: 'error',
        });
      }

      values.push(formatValue(value, mapping, config));
    }

    if (config.mode === 'INSERT') {
      currentBatch.push(`(${values.join(', ')})`);
    } else if (config.mode === 'UPDATE') {
      if (pkMapping) {
        const pkIndex = activeMappings.indexOf(pkMapping);
        const pkValue = values[pkIndex];
        const setClauses = activeMappings
          .filter(m => !m.isPrimaryKey)
          .map((m) => `${m.pgColumn} = ${values[activeMappings.indexOf(m)]}`);

        if (setClauses.length > 0) {
          const updateSql = adapter.buildUpdate(
            config.tableName,
            setClauses,
            `${pkMapping.pgColumn} = ${pkValue}`
          );
          currentBatch.push(updateSql);
        }
      }
    } else if (config.mode === 'UPSERT') {
      currentBatch.push(`(${values.join(', ')})`);
    }

    if (currentBatch.length >= config.options.batchSize) {
      batches.push([...currentBatch]);
      currentBatch = [];
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  // Generate batch statements
  for (const batch of batches) {
    if (config.mode === 'INSERT') {
      const valueRows = batch.map(v => [v.slice(1, -1)]); // Remove outer parens for adapter
      statements.push(`INSERT INTO ${config.tableName} (${columnNames.join(', ')})`);
      statements.push('VALUES');
      statements.push(batch.join(',\n'));
      statements.push(';');
      statements.push('');
    } else if (config.mode === 'UPDATE') {
      statements.push(...batch);
      statements.push('');
    } else if (config.mode === 'UPSERT') {
      const conflictKeys = config.conflictKeys.length > 0
        ? config.conflictKeys
        : (pkMapping ? [pkMapping.pgColumn] : []);

      const updateColumns = activeMappings
        .filter(m => !conflictKeys.includes(m.pgColumn))
        .map(m => m.pgColumn);

      if (database === 'mysql') {
        // MySQL: ON DUPLICATE KEY UPDATE
        statements.push(`INSERT INTO ${config.tableName} (${columnNames.join(', ')})`);
        statements.push('VALUES');
        statements.push(batch.join(',\n'));

        if (config.options.onConflictAction === 'DO UPDATE' && updateColumns.length > 0) {
          const updateClauses = updateColumns.map(col => `${col} = VALUES(${col})`).join(', ');
          statements.push(`ON DUPLICATE KEY UPDATE ${updateClauses};`);
        } else {
          // MySQL INSERT IGNORE for "do nothing"
          statements[statements.length - 3] = `INSERT IGNORE INTO ${config.tableName} (${columnNames.join(', ')})`;
          statements.push(';');
        }
      } else {
        // PostgreSQL: ON CONFLICT
        statements.push(`INSERT INTO ${config.tableName} (${columnNames.join(', ')})`);
        statements.push('VALUES');
        statements.push(batch.join(',\n'));
        statements.push(`ON CONFLICT (${conflictKeys.join(', ')})`);

        if (config.options.onConflictAction === 'DO UPDATE' && updateColumns.length > 0) {
          const updateClauses = updateColumns.map(col => `${col} = EXCLUDED.${col}`).join(', ');
          statements.push(`DO UPDATE SET ${updateClauses};`);
        } else {
          statements.push('DO NOTHING;');
        }
      }
      statements.push('');
    }
  }

  // Transaction commit
  if (config.options.wrapInTransaction) {
    statements.push(adapter.commitTransaction());
  }

  // Add standardized header comment with Bangkok timezone
  const adapterName = adapter.displayName;
  const header = [
    `-- Generated by Excel-HelpMe`,
    `-- Database: ${adapterName}`,
    `-- File: ${data.fileName}`,
    `-- Sheet: ${data.sheetName}`,
    `-- Rows: ${data.totalRows}`,
    `-- Mode: ${config.mode}`,
    `-- Generated: ${getBangkokTimestamp()}`,
    '',
  ];

  return {
    sql: [...header, ...statements].join('\n'),
    errors,
  };
}

export function downloadSQL(sql: string, filename: string): void {
  const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
