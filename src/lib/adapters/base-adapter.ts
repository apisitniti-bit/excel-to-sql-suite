// Database Adapter Interface
// Provides database-agnostic SQL generation

export type DatabaseType = 'postgresql' | 'mysql' | 'mssql';

export interface ConnectionConfig {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
}

export interface ExecutionResult {
    success: boolean;
    rowsAffected: number;
    error?: string;
    details?: any;
}

export interface DatabaseAdapter {
    readonly name: DatabaseType;
    readonly displayName: string;

    // Identifier quoting
    quoteIdentifier(name: string): string;

    // Value formatting
    formatValue(value: any, type: string): string;

    // Statement builders
    buildInsert(table: string, columns: string[], valueRows: string[][]): string;
    buildUpdate(table: string, setClauses: string[], whereClause: string): string;
    buildUpsert(
        table: string,
        columns: string[],
        valueRows: string[][],
        conflictKeys: string[],
        updateColumns: string[]
    ): string;

    // Transaction control
    beginTransaction(): string;
    commitTransaction(): string;
    rollbackTransaction(): string;
    createSavepoint(name: string): string;
    rollbackToSavepoint(name: string): string;

    // Batch formatting
    formatBatchValues(valueRows: string[][]): string;
}

// Registry for available adapters
const adapterRegistry: Map<DatabaseType, DatabaseAdapter> = new Map();

export function registerAdapter(adapter: DatabaseAdapter): void {
    adapterRegistry.set(adapter.name, adapter);
}

export function getAdapter(type: DatabaseType): DatabaseAdapter {
    const adapter = adapterRegistry.get(type);
    if (!adapter) {
        throw new Error(`Database adapter not found: ${type}`);
    }
    return adapter;
}

export function getAvailableAdapters(): DatabaseAdapter[] {
    return Array.from(adapterRegistry.values());
}

export function getAvailableDatabaseTypes(): DatabaseType[] {
    return Array.from(adapterRegistry.keys());
}
