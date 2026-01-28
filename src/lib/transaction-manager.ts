import type { DatabaseType } from './adapters';

/**
 * Transaction Manager
 * Handles transaction lifecycle (BEGIN, COMMIT, ROLLBACK, SAVEPOINT)
 * Provides automatic transaction management with error recovery
 */

export interface TransactionConfig {
  autoCommit: boolean;
  isolationLevel: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  timeout: number; // milliseconds
  retryAttempts: number;
  retryDelay: number; // milliseconds
}

export interface SavepointMarker {
  name: string;
  createdAt: number;
  batchId: number;
  rowsProcessed: number;
}

export interface TransactionState {
  isActive: boolean;
  startTime: number;
  savepoints: SavepointMarker[];
  lastError: Error | null;
  statementCount: number;
  rowsAffected: number;
}

export class TransactionManager {
  private isActive: boolean = false;
  private startTime: number = 0;
  private savepoints: Map<string, SavepointMarker> = new Map();
  private statementCount: number = 0;
  private rowsAffected: number = 0;
  private lastError: Error | null = null;
  private config: TransactionConfig;
  private database: DatabaseType;
  private readonly sqlStatements: string[] = [];

  constructor(database: DatabaseType, config?: Partial<TransactionConfig>) {
    this.database = database;
    this.config = {
      autoCommit: false,
      isolationLevel: 'READ COMMITTED',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };
  }

  /**
   * Begin a transaction
   */
  beginTransaction(): string {
    if (this.isActive) {
      throw new Error('Transaction already active. Commit or rollback first.');
    }

    this.isActive = true;
    this.startTime = Date.now();
    this.savepoints.clear();
    this.statementCount = 0;
    this.rowsAffected = 0;
    this.lastError = null;
    this.sqlStatements.length = 0;

    const statement = this.buildBeginStatement();
    this.sqlStatements.push(statement);
    return statement;
  }

  /**
   * Commit transaction
   */
  commitTransaction(): string {
    if (!this.isActive) {
      throw new Error('No active transaction to commit.');
    }

    this.isActive = false;
    const statement = this.buildCommitStatement();
    this.sqlStatements.push(statement);
    return statement;
  }

  /**
   * Rollback transaction
   */
  rollbackTransaction(): string {
    if (!this.isActive) {
      throw new Error('No active transaction to rollback.');
    }

    this.isActive = false;
    this.savepoints.clear();
    const statement = this.buildRollbackStatement();
    this.sqlStatements.push(statement);
    return statement;
  }

  /**
   * Create a savepoint within a transaction
   */
  createSavepoint(name: string): string {
    if (!this.isActive) {
      throw new Error('Cannot create savepoint without active transaction.');
    }

    if (this.savepoints.has(name)) {
      throw new Error(`Savepoint "${name}" already exists.`);
    }

    const marker: SavepointMarker = {
      name,
      createdAt: Date.now(),
      batchId: this.statementCount,
      rowsProcessed: this.rowsAffected,
    };

    this.savepoints.set(name, marker);
    const statement = this.buildSavepointStatement(name);
    this.sqlStatements.push(statement);
    return statement;
  }

  /**
   * Release a savepoint
   */
  releaseSavepoint(name: string): string {
    if (!this.isActive) {
      throw new Error('Cannot release savepoint without active transaction.');
    }

    const marker = this.savepoints.get(name);
    if (!marker) {
      throw new Error(`Savepoint "${name}" does not exist.`);
    }

    this.savepoints.delete(name);
    const statement = this.buildReleaseSavepointStatement(name);
    this.sqlStatements.push(statement);
    return statement;
  }

  /**
   * Rollback to savepoint
   */
  rollbackToSavepoint(name: string): string {
    if (!this.isActive) {
      throw new Error('Cannot rollback to savepoint without active transaction.');
    }

    const marker = this.savepoints.get(name);
    if (!marker) {
      throw new Error(`Savepoint "${name}" does not exist.`);
    }

    // Reset state to savepoint
    this.rowsAffected = marker.rowsProcessed;
    const statement = this.buildRollbackToSavepointStatement(name);
    this.sqlStatements.push(statement);
    return statement;
  }

  /**
   * Execute a statement within transaction (track it)
   */
  trackStatement(sql: string, rowsAffected: number = 0): void {
    if (!this.isActive) {
      throw new Error('No active transaction. Call beginTransaction() first.');
    }

    this.sqlStatements.push(sql);
    this.statementCount++;
    this.rowsAffected += rowsAffected;
  }

  /**
   * Set error for transaction context
   */
  setError(error: Error): void {
    this.lastError = error;
  }

  /**
   * Get current transaction state
   */
  getState(): TransactionState {
    return {
      isActive: this.isActive,
      startTime: this.startTime,
      savepoints: Array.from(this.savepoints.values()),
      lastError: this.lastError,
      statementCount: this.statementCount,
      rowsAffected: this.rowsAffected,
    };
  }

  /**
   * Get duration of current transaction in milliseconds
   */
  getDuration(): number {
    if (!this.isActive) {
      return 0;
    }
    return Date.now() - this.startTime;
  }

  /**
   * Get all SQL statements in transaction
   */
  getStatements(): string[] {
    return [...this.sqlStatements];
  }

  /**
   * Get all savepoints
   */
  getSavepoints(): SavepointMarker[] {
    return Array.from(this.savepoints.values());
  }

  /**
   * Check if savepoint exists
   */
  hasSavepoint(name: string): boolean {
    return this.savepoints.has(name);
  }

  /**
   * Reset transaction state (for cleanup)
   */
  reset(): void {
    this.isActive = false;
    this.startTime = 0;
    this.savepoints.clear();
    this.statementCount = 0;
    this.rowsAffected = 0;
    this.lastError = null;
    this.sqlStatements.length = 0;
  }

  /**
   * Build BEGIN statement for database
   */
  private buildBeginStatement(): string {
    switch (this.database) {
      case 'postgresql':
        return `BEGIN TRANSACTION ISOLATION LEVEL ${this.config.isolationLevel};`;
      case 'mysql':
        return 'START TRANSACTION;';
      case 'mssql':
        return 'BEGIN TRANSACTION;';
      default:
        return 'BEGIN TRANSACTION;';
    }
  }

  /**
   * Build COMMIT statement for database
   */
  private buildCommitStatement(): string {
    switch (this.database) {
      case 'postgresql':
        return 'COMMIT TRANSACTION;';
      case 'mysql':
        return 'COMMIT;';
      case 'mssql':
        return 'COMMIT TRANSACTION;';
      default:
        return 'COMMIT;';
    }
  }

  /**
   * Build ROLLBACK statement for database
   */
  private buildRollbackStatement(): string {
    switch (this.database) {
      case 'postgresql':
        return 'ROLLBACK TRANSACTION;';
      case 'mysql':
        return 'ROLLBACK;';
      case 'mssql':
        return 'ROLLBACK TRANSACTION;';
      default:
        return 'ROLLBACK;';
    }
  }

  /**
   * Build SAVEPOINT statement for database
   */
  private buildSavepointStatement(name: string): string {
    const safeName = this.escapeSavepointName(name);

    switch (this.database) {
      case 'postgresql':
        return `SAVEPOINT ${safeName};`;
      case 'mysql':
        return `SAVEPOINT ${safeName};`;
      case 'mssql':
        return `SAVE TRANSACTION ${safeName};`;
      default:
        return `SAVEPOINT ${safeName};`;
    }
  }

  /**
   * Build RELEASE SAVEPOINT statement for database
   */
  private buildReleaseSavepointStatement(name: string): string {
    const safeName = this.escapeSavepointName(name);

    switch (this.database) {
      case 'postgresql':
        return `RELEASE SAVEPOINT ${safeName};`;
      case 'mysql':
        return `RELEASE SAVEPOINT ${safeName};`;
      case 'mssql':
        return `-- SQL Server auto-releases savepoints`;
      default:
        return `RELEASE SAVEPOINT ${safeName};`;
    }
  }

  /**
   * Build ROLLBACK TO SAVEPOINT statement for database
   */
  private buildRollbackToSavepointStatement(name: string): string {
    const safeName = this.escapeSavepointName(name);

    switch (this.database) {
      case 'postgresql':
        return `ROLLBACK TO SAVEPOINT ${safeName};`;
      case 'mysql':
        return `ROLLBACK TO SAVEPOINT ${safeName};`;
      case 'mssql':
        return `ROLLBACK TRANSACTION ${safeName};`;
      default:
        return `ROLLBACK TO SAVEPOINT ${safeName};`;
    }
  }

  /**
   * Escape savepoint name for SQL
   */
  private escapeSavepointName(name: string): string {
    // Savepoint names must be alphanumeric + underscore
    return name.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 63);
  }
}

/**
 * Transaction execution wrapper with automatic error handling
 */
export class TransactionExecutor {
  constructor(
    private manager: TransactionManager,
    private database: DatabaseType
  ) {}

  /**
   * Execute a function within a transaction
   * Automatically handles BEGIN/COMMIT/ROLLBACK
   */
  async execute<T>(
    fn: () => Promise<T>,
    onError?: (error: Error) => void
  ): Promise<T> {
    try {
      this.manager.beginTransaction();

      const result = await fn();

      this.manager.commitTransaction();
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.manager.setError(err);

      if (onError) {
        onError(err);
      }

      this.manager.rollbackTransaction();
      throw err;
    }
  }

  /**
   * Execute with savepoint support for batch operations
   */
  async executeBatch<T>(
    batchId: number,
    fn: () => Promise<T>,
    onBatchError?: (error: Error, batchId: number) => void
  ): Promise<T> {
    const savepointName = `BATCH_${batchId}_SP`;

    try {
      this.manager.createSavepoint(savepointName);

      const result = await fn();

      this.manager.releaseSavepoint(savepointName);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (onBatchError) {
        onBatchError(err, batchId);
      }

      // Rollback to savepoint, but keep transaction active for other batches
      this.manager.rollbackToSavepoint(savepointName);
      throw err;
    }
  }

  /**
   * Get current state
   */
  getState() {
    return this.manager.getState();
  }

  /**
   * Get all SQL statements
   */
  getStatements() {
    return this.manager.getStatements();
  }
}

// Default instance
let globalTransactionManager: TransactionManager | null = null;

/**
 * Get or create global transaction manager
 */
export function getTransactionManager(database: DatabaseType): TransactionManager {
  if (!globalTransactionManager) {
    globalTransactionManager = new TransactionManager(database);
  }
  return globalTransactionManager;
}

/**
 * Reset global transaction manager (for cleanup)
 */
export function resetTransactionManager(): void {
  if (globalTransactionManager) {
    globalTransactionManager.reset();
    globalTransactionManager = null;
  }
}
