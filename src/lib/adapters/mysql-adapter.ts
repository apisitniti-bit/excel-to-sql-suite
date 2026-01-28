// MySQL Database Adapter

import type { DatabaseAdapter } from './base-adapter';
import { registerAdapter } from './base-adapter';

export const MySQLAdapter: DatabaseAdapter = {
    name: 'mysql',
    displayName: 'MySQL',

    quoteIdentifier(name: string): string {
        // MySQL uses backticks, but we're not quoting as per user preference
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
            case 'INT':
            case 'SMALLINT':
            case 'TINYINT':
                return String(parseInt(strValue, 10));
            case 'DECIMAL':
            case 'NUMERIC':
            case 'FLOAT':
            case 'DOUBLE':
                return String(parseFloat(strValue));
            case 'BOOLEAN':
            case 'BOOL':
                return ['true', '1', 'yes'].includes(strValue.toLowerCase()) ? '1' : '0';
            default:
                // Escape single quotes and backslashes for MySQL
                return `'${strValue.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
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

        let sql = `INSERT INTO ${table} (${columnList})\nVALUES\n${values}`;

        if (updateColumns.length > 0) {
            // MySQL uses ON DUPLICATE KEY UPDATE
            const updateClauses = updateColumns.map(col => `${col} = VALUES(${col})`).join(', ');
            sql += `\nON DUPLICATE KEY UPDATE ${updateClauses};`;
        } else {
            // MySQL uses INSERT IGNORE for "do nothing" behavior
            sql = `INSERT IGNORE INTO ${table} (${columnList})\nVALUES\n${values};`;
        }

        return sql;
    },

    beginTransaction(): string {
        return 'START TRANSACTION;';
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
registerAdapter(MySQLAdapter);
