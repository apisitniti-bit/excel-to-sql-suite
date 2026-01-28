import { Pool, PoolClient, QueryResult } from 'pg';
import mysql from 'mysql2/promise';
import { ConnectionPool, Connection, ConnectionError, QueryError, ConnectionConfig } from 'mssql';
import type { DatabaseType } from './adapters';

/**
 * Database Connection Manager
 * Handles connection pooling and lifecycle management for multiple database systems
 * Supports PostgreSQL, MySQL, and SQL Server with automatic failover and reconnection
 */

export interface DbConnectionConfig {
  database: DatabaseType;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean;
  poolSize?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface DbConnectionOptions {
  poolSize: number;
  connectionTimeout: number;
  idleTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
}

export interface ConnectionState {
  isConnected: boolean;
  isHealthy: boolean;
  poolSize: number;
  activeConnections: number;
  totalConnections: number;
  lastActivity: Date;
  error?: string;
}

type PostgresPool = Pool;
type MysqlPool = mysql.Pool;
type MssqlPool = ConnectionPool;

/**
 * Database Connection Manager for production environments
 */
class DatabaseConnectionManager {
  private database: DatabaseType;
  private config: DbConnectionConfig;
  private options: DbConnectionOptions;
  private pool: PostgresPool | MysqlPool | MssqlPool | null = null;
  private isConnected = false;
  private activeConnections = 0;
  private lastActivity: Date = new Date();
  private connectionError: string | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: DbConnectionConfig, options?: Partial<DbConnectionOptions>) {
    this.database = config.database;
    this.config = config;
    this.options = {
      poolSize: options?.poolSize ?? 10,
      connectionTimeout: options?.connectionTimeout ?? 30000,
      idleTimeout: options?.idleTimeout ?? 30000,
      retryAttempts: options?.retryAttempts ?? 3,
      retryDelay: options?.retryDelay ?? 1000,
    };

    if (!this.isValidConfig()) {
      throw new Error('Invalid database configuration');
    }
  }

  /**
   * Establish connection to database
   */
  async connect(): Promise<void> {
    try {
      switch (this.database) {
        case 'postgresql':
          await this.connectPostgres();
          break;
        case 'mysql':
          await this.connectMysql();
          break;
        case 'mssql':
          await this.connectMssql();
          break;
        default:
          throw new Error(`Unsupported database: ${this.database}`);
      }

      this.isConnected = true;
      this.connectionError = null;
      this.startHealthCheck();
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      this.connectionError = err;
      this.isConnected = false;
      throw new Error(`Failed to connect to ${this.database}: ${err}`);
    }
  }

  /**
   * Connect to PostgreSQL database
   */
  private async connectPostgres(): Promise<void> {
    const pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      max: this.options.poolSize,
      connectionTimeoutMillis: this.options.connectionTimeout,
      idleTimeoutMillis: this.options.idleTimeout,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
    });

    // Test connection
    const client = await pool.connect();
    try {
      await client.query('SELECT NOW()');
    } finally {
      client.release();
    }

    this.pool = pool;
  }

  /**
   * Connect to MySQL database
   */
  private async connectMysql(): Promise<void> {
    const pool = await mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      connectionLimit: this.options.poolSize,
      waitForConnections: true,
      enableKeepAlive: true,
      keepAliveInitialDelayMs: 0,
    });

    // Test connection
    const connection = await pool.getConnection();
    try {
      await connection.query('SELECT NOW()');
    } finally {
      await connection.end();
    }

    this.pool = pool;
  }

  /**
   * Connect to SQL Server database
   */
  private async connectMssql(): Promise<void> {
    const pool = new ConnectionPool({
      server: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      pool: {
        min: 2,
        max: this.options.poolSize,
        idleTimeoutMillis: this.options.idleTimeout,
      },
      options: {
        encrypt: this.config.ssl ?? true,
        trustServerCertificate: true,
        connectTimeout: this.options.connectionTimeout,
      },
    });

    pool.on('error', (err) => {
      this.connectionError = err.message;
    });

    await pool.connect();

    // Test connection
    await pool.request().query('SELECT GETDATE()');

    this.pool = pool;
  }

  /**
   * Execute a query
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    if (!this.isConnected) {
      throw new Error('Database connection not established');
    }

    this.activeConnections++;
    this.lastActivity = new Date();

    try {
      let result: any;

      switch (this.database) {
        case 'postgresql': {
          const pgPool = this.pool as PostgresPool;
          result = await pgPool.query(sql, params);
          return {
            rows: result.rows as T[],
            rowCount: result.rowCount ?? 0,
            command: result.command,
          };
        }

        case 'mysql': {
          const mysqlPool = this.pool as MysqlPool;
          const [rows, fields] = await mysqlPool.query(sql, params);
          return {
            rows: rows as T[],
            rowCount: Array.isArray(rows) ? rows.length : 0,
            command: 'SELECT',
          };
        }

        case 'mssql': {
          const mssqlPool = this.pool as MssqlPool;
          const request = mssqlPool.request();

          // Add parameters
          params.forEach((param, index) => {
            request.input(`param${index}`, param);
          });

          result = await request.query(sql);
          return {
            rows: result.recordset as T[],
            rowCount: result.rowsAffected[0] ?? 0,
            command: 'QUERY',
          };
        }

        default:
          throw new Error(`Unsupported database: ${this.database}`);
      }
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      throw new QueryError(`Query failed: ${err}`, sql, params);
    } finally {
      this.activeConnections--;
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(
    callback: (executor: TransactionExecutor) => Promise<T>
  ): Promise<T> {
    if (!this.isConnected) {
      throw new Error('Database connection not established');
    }

    const executor = new TransactionExecutor(this.database, this.pool as any);

    try {
      return await executor.execute(callback);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Health check - verify connection is active
   */
  async healthCheck(): Promise<boolean> {
    try {
      switch (this.database) {
        case 'postgresql': {
          const pgPool = this.pool as PostgresPool;
          const result = await pgPool.query('SELECT 1');
          return result.rowCount === 1;
        }

        case 'mysql': {
          const mysqlPool = this.pool as MysqlPool;
          const [rows] = await mysqlPool.query('SELECT 1');
          return Array.isArray(rows) && rows.length > 0;
        }

        case 'mssql': {
          const mssqlPool = this.pool as MssqlPool;
          await mssqlPool.request().query('SELECT 1');
          return true;
        }

        default:
          return false;
      }
    } catch (error) {
      this.connectionError = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  /**
   * Start periodic health check
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      const isHealthy = await this.healthCheck();
      if (!isHealthy && this.isConnected) {
        console.warn(`Health check failed for ${this.database} connection`);
        await this.reconnect();
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Reconnect to database
   */
  async reconnect(): Promise<void> {
    await this.disconnect();

    let attempts = 0;
    while (attempts < this.options.retryAttempts) {
      try {
        await this.connect();
        return;
      } catch (error) {
        attempts++;
        if (attempts < this.options.retryAttempts) {
          await new Promise(resolve => 
            setTimeout(resolve, this.options.retryDelay * attempts)
          );
        }
      }
    }

    throw new Error(
      `Failed to reconnect after ${this.options.retryAttempts} attempts`
    );
  }

  /**
   * Get connection state
   */
  getState(): ConnectionState {
    return {
      isConnected: this.isConnected,
      isHealthy: this.connectionError === null,
      poolSize: this.options.poolSize,
      activeConnections: this.activeConnections,
      totalConnections: this.activeConnections, // Would need pool introspection for true total
      lastActivity: this.lastActivity,
      error: this.connectionError ?? undefined,
    };
  }

  /**
   * Close connection
   */
  async disconnect(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (!this.pool) {
      return;
    }

    try {
      switch (this.database) {
        case 'postgresql': {
          const pgPool = this.pool as PostgresPool;
          await pgPool.end();
          break;
        }

        case 'mysql': {
          const mysqlPool = this.pool as MysqlPool;
          await mysqlPool.end();
          break;
        }

        case 'mssql': {
          const mssqlPool = this.pool as MssqlPool;
          await mssqlPool.close();
          break;
        }
      }
    } catch (error) {
      console.error('Error closing connection:', error);
    }

    this.isConnected = false;
    this.pool = null;
  }

  /**
   * Validate configuration
   */
  private isValidConfig(): boolean {
    return (
      !!this.config.host &&
      !!this.config.port &&
      !!this.config.user &&
      !!this.config.password &&
      !!this.config.database
    );
  }
}

/**
 * Transaction Executor for safe transaction management
 */
class TransactionExecutor {
  private database: DatabaseType;
  private pool: any;
  private inTransaction = false;

  constructor(database: DatabaseType, pool: any) {
    this.database = database;
    this.pool = pool;
  }

  /**
   * Execute callback within transaction
   */
  async execute<T>(callback: (executor: this) => Promise<T>): Promise<T> {
    const client = await this.getClient();

    try {
      await this.beginTransaction(client);
      this.inTransaction = true;

      const result = await callback(this);

      await this.commit(client);
      this.inTransaction = false;

      return result;
    } catch (error) {
      if (this.inTransaction) {
        await this.rollback(client);
      }
      throw error;
    } finally {
      await this.releaseClient(client);
    }
  }

  /**
   * Query within transaction
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    // This would be implemented with the client connection
    // For now, a placeholder
    throw new Error('Query not implemented in transaction executor');
  }

  /**
   * Get database client
   */
  private async getClient(): Promise<any> {
    switch (this.database) {
      case 'postgresql': {
        return await (this.pool as PostgresPool).connect();
      }

      case 'mysql': {
        return await (this.pool as MysqlPool).getConnection();
      }

      case 'mssql': {
        return (this.pool as MssqlPool).request();
      }

      default:
        throw new Error(`Unsupported database: ${this.database}`);
    }
  }

  /**
   * Release client connection
   */
  private async releaseClient(client: any): Promise<void> {
    switch (this.database) {
      case 'postgresql':
        client.release();
        break;

      case 'mysql':
        await client.end();
        break;

      case 'mssql':
        // MSSQL request doesn't need explicit release
        break;
    }
  }

  /**
   * Begin transaction
   */
  private async beginTransaction(client: any): Promise<void> {
    switch (this.database) {
      case 'postgresql':
        await client.query('BEGIN');
        break;

      case 'mysql':
        await client.query('START TRANSACTION');
        break;

      case 'mssql':
        await client.query('BEGIN TRANSACTION');
        break;
    }
  }

  /**
   * Commit transaction
   */
  private async commit(client: any): Promise<void> {
    switch (this.database) {
      case 'postgresql':
        await client.query('COMMIT');
        break;

      case 'mysql':
        await client.query('COMMIT');
        break;

      case 'mssql':
        await client.query('COMMIT TRANSACTION');
        break;
    }
  }

  /**
   * Rollback transaction
   */
  private async rollback(client: any): Promise<void> {
    switch (this.database) {
      case 'postgresql':
        await client.query('ROLLBACK');
        break;

      case 'mysql':
        await client.query('ROLLBACK');
        break;

      case 'mssql':
        await client.query('ROLLBACK TRANSACTION');
        break;
    }
  }
}

/**
 * Custom error classes
 */
export class QueryError extends Error {
  constructor(
    message: string,
    public sql: string,
    public params: any[]
  ) {
    super(message);
    this.name = 'QueryError';
  }
}

export class ConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectionError';
  }
}

// Export singleton factory
export function createDatabaseConnection(
  config: DbConnectionConfig,
  options?: Partial<DbConnectionOptions>
): DatabaseConnectionManager {
  return new DatabaseConnectionManager(config, options);
}

export { DatabaseConnectionManager, TransactionExecutor };
