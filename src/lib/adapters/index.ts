// Database Adapters Index
// Export all adapters and utilities

export type { DatabaseAdapter, DatabaseType, ConnectionConfig, ExecutionResult } from './base-adapter';
export { getAdapter, getAvailableAdapters, getAvailableDatabaseTypes, registerAdapter } from './base-adapter';

// Import adapters to trigger registration
import './postgresql-adapter';
import './mysql-adapter';

export { PostgreSQLAdapter } from './postgresql-adapter';
export { MySQLAdapter } from './mysql-adapter';
