// PostgreSQL Database Adapter

import type { DatabaseAdapter } from './base-adapter';
import { registerAdapter } from './base-adapter';

export const PostgreSQLAdapter: DatabaseAdapter = {
    name: 'postgresql',
    displayName: 'PostgreSQL',

    quoteIdentifier(name: string): string {
        // PostgreSQL uses double quotes, but we're not quoting as per user preference
        return name;
    },

    formatValue(value: any, type: string): string {
        if (value === null || value === undefined) {
            return 'NULL';
        }

        const strValue = String(value);

        switch (type.toUpperCase()) {
            case 'INTEGER':
            case 'BIGINT':
                return String(parseInt(strValue, 10));
            case 'DECIMAL':
            case 'NUMERIC':
            case 'FLOAT':
            case 'DOUBLE':
                return String(parseFloat(strValue));
            case 'BOOLEAN':
                return ['true', '1', 'yes'].includes(strValue.toLowerCase()) ? 'TRUE' : 'FALSE';
            default:
                // Escape single quotes
                return `'${strValue.replace(/'/g, "''")}'`;
        }
    },

    buildInsert(table: string, columns: string[], valueRows: string[][]): string {
        const columnList = columns.join(', ');
        const values = this.formatBatchValues(valueRows);
        return `INSERT INTO ${table} (${columnList})\nVALUES\n${values};`;
    },

    buildUpdate(table: string, setClauses: string[], whereClause: string): string {
        return `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${whereClause};`;
    },

    buildUpsert(
        table: string,
        columns: string[],
        valueRows: string[][],
        conflictKeys: string[],
        updateColumns: string[]
    ): string {
        const columnList = columns.join(', ');
        const values = this.formatBatchValues(valueRows);
        const conflictList = conflictKeys.join(', ');

        let sql = `INSERT INTO ${table} (${columnList})\nVALUES\n${values}\nON CONFLICT (${conflictList})`;

        if (updateColumns.length > 0) {
            const updateClauses = updateColumns.map(col => `${col} = EXCLUDED.${col}`).join(', ');
            sql += `\nDO UPDATE SET ${updateClauses};`;
        } else {
            sql += '\nDO NOTHING;';
        }

        return sql;
    },

    beginTransaction(): string {
        return 'BEGIN;';
    },

    commitTransaction(): string {
        return 'COMMIT;';
    },

    rollbackTransaction(): string {
        return 'ROLLBACK;';
    },

    createSavepoint(name: string): string {
        return `SAVEPOINT ${name};`;
    },

    rollbackToSavepoint(name: string): string {
        return `ROLLBACK TO SAVEPOINT ${name};`;
    },

    formatBatchValues(valueRows: string[][]): string {
        return valueRows.map(row => `(${row.join(', ')})`).join(',\n');
    }
};

// Register the adapter
registerAdapter(PostgreSQLAdapter);
