import type { ExcelData, ColumnMapping, SqlConfig, ValidationError } from '@/types/converter';
import { getBangkokTimestamp } from './timezone';

function escapeString(value: string, trim: boolean): string {
  let escaped = trim ? value.trim() : value;
  escaped = escaped.replace(/'/g, "''");
  return `'${escaped}'`;
}

function formatValue(
  value: any, 
  mapping: ColumnMapping, 
  config: SqlConfig
): string {
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
      return config.options.castTypes 
        ? `${parseInt(strValue, 10)}::${mapping.dataType}` 
        : String(parseInt(strValue, 10));
    
    case 'DECIMAL':
      return config.options.castTypes 
        ? `${parseFloat(strValue)}::DECIMAL` 
        : String(parseFloat(strValue));
    
    case 'BOOLEAN':
      const boolVal = ['true', '1', 'yes'].includes(strValue.toLowerCase());
      return boolVal ? 'TRUE' : 'FALSE';
    
    case 'JSON':
    case 'JSONB':
      return config.options.castTypes
        ? `${escapeString(strValue, config.options.trimStrings)}::${mapping.dataType}`
        : escapeString(strValue, config.options.trimStrings);
    
    case 'UUID':
      return config.options.castTypes
        ? `${escapeString(strValue, config.options.trimStrings)}::UUID`
        : escapeString(strValue, config.options.trimStrings);
    
    case 'DATE':
    case 'TIMESTAMP':
    case 'TIMESTAMPTZ':
      return config.options.castTypes
        ? `${escapeString(strValue, config.options.trimStrings)}::${mapping.dataType}`
        : escapeString(strValue, config.options.trimStrings);
    
    default:
      return escapeString(strValue, config.options.trimStrings);
  }
}

export function generateSQL(
  data: ExcelData,
  mappings: ColumnMapping[],
  config: SqlConfig
): { sql: string; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const statements: string[] = [];
  
  if (config.options.wrapInTransaction) {
    statements.push('BEGIN;');
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
  
  const columns = activeMappings.map(m => `"${m.pgColumn}"`).join(', ');
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
      // VALUES format: (col1, col2, ...)
      currentBatch.push(`(${values.join(', ')})`);
    } else if (config.mode === 'UPDATE') {
      if (pkMapping) {
        const pkIndex = activeMappings.indexOf(pkMapping);
        const pkValue = values[pkIndex];
        const setClauses = activeMappings
          .filter(m => !m.isPrimaryKey)
          .map((m) => `"${m.pgColumn}" = ${values[activeMappings.indexOf(m)]}`)
          .join(', ');
        
        if (setClauses) {
          currentBatch.push(`UPDATE "${config.tableName}" SET ${setClauses} WHERE "${pkMapping.pgColumn}" = ${pkValue};`);
        }
      }
    } else if (config.mode === 'UPSERT') {
      currentBatch.push(`  (${values.join(', ')})`);
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
      // INSERT INTO table (cols) VALUES (row1), (row2), ... (rowN);
      statements.push(`INSERT INTO "${config.tableName}" (${columns})`);
      statements.push('VALUES');
      statements.push(batch.join(',\n'));
      statements.push(';');
      statements.push('');
    } else if (config.mode === 'UPDATE') {
      statements.push(...batch);
      statements.push('');
    } else if (config.mode === 'UPSERT') {
      const conflictCols = config.conflictKeys.map(k => `"${k}"`).join(', ');
      const updateCols = activeMappings
        .filter(m => !config.conflictKeys.includes(m.pgColumn))
        .map(m => `"${m.pgColumn}" = EXCLUDED."${m.pgColumn}"`)
        .join(', ');
      
      statements.push(`INSERT INTO "${config.tableName}" (${columns})`);
      statements.push('VALUES');
      statements.push(batch.join(',\n'));
      statements.push(`ON CONFLICT (${conflictCols})`);
      
      if (config.options.onConflictAction === 'DO UPDATE' && updateCols) {
        statements.push(`DO UPDATE SET ${updateCols};`);
      } else {
        statements.push('DO NOTHING;');
      }
      statements.push('');
    }
  }
  
  if (config.options.wrapInTransaction) {
    statements.push('COMMIT;');
  }
  
  // Add standardized header comment with Bangkok timezone
  const header = [
    `-- Generated by Excel-HelpMe`,
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
