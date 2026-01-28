import type { ExcelData, ColumnMapping, SqlConfig } from '@/types/converter';
import { createDirectExecutor, type DirectExecutor, type ExecutionProgress } from './direct-executor';
import type { DatabaseType } from './adapters';
import type { DbConnectionConfig } from './database-connection-mock';

/**
 * WebSocket Server for Real-Time Progress Tracking
 * Enables real-time status updates during long-running operations
 */

export interface WebSocketMessage {
  id: string;
  type: 'progress' | 'error' | 'complete' | 'subscribe' | 'unsubscribe';
  payload: any;
  timestamp: number;
}

export interface ConversionSession {
  sessionId: string;
  startTime: number;
  excelData: ExcelData;
  mappings: ColumnMapping[];
  config: SqlConfig;
  database?: DatabaseType;
  connectionConfig?: DbConnectionConfig;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: ExecutionProgress;
  subscribers: Set<string>; // Connection IDs
  result?: any;
  error?: string;
}

class WebSocketServer {
  private sessions: Map<string, ConversionSession> = new Map();
  private subscribers: Map<string, Set<string>> = new Map(); // sessionId -> connectionIds
  private directExecutors: Map<string, DirectExecutor> = new Map(); // database -> executor

  /**
   * Create a new conversion session
   */
  createSession(
    excelData: ExcelData,
    mappings: ColumnMapping[],
    config: SqlConfig,
    database?: DatabaseType,
    connectionConfig?: DbConnectionConfig
  ): ConversionSession {
    const sessionId = this.generateSessionId();

    const session: ConversionSession = {
      sessionId,
      startTime: Date.now(),
      excelData,
      mappings,
      config,
      database,
      connectionConfig,
      status: 'pending',
      progress: {
        status: 'pending',
        percentage: 0,
        currentBatch: 0,
        totalBatches: 0,
        rowsProcessed: 0,
        rowsFailed: 0,
        rowsTotal: excelData.totalRows,
        estimatedTimeRemaining: 0,
      },
      subscribers: new Set(),
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Subscribe to session updates
   */
  subscribe(sessionId: string, connectionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.subscribers.add(connectionId);

    if (!this.subscribers.has(sessionId)) {
      this.subscribers.set(sessionId, new Set());
    }
    this.subscribers.get(sessionId)!.add(connectionId);

    return true;
  }

  /**
   * Unsubscribe from session updates
   */
  unsubscribe(sessionId: string, connectionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.subscribers.delete(connectionId);
    }

    const subs = this.subscribers.get(sessionId);
    if (subs) {
      subs.delete(connectionId);
      if (subs.size === 0) {
        this.subscribers.delete(sessionId);
      }
    }
  }

  /**
   * Execute direct conversion with real-time progress
   */
  async executeSession(
    session: ConversionSession,
    onMessage?: (message: WebSocketMessage) => void
  ): Promise<void> {
    const { sessionId, excelData, mappings, config, database, connectionConfig } = session;

    try {
      session.status = 'processing';

      // Initialize or get executor
      if (!database || !connectionConfig) {
        throw new Error('Database configuration required for execution');
      }

      let executor = this.directExecutors.get(database);
      if (!executor) {
        executor = createDirectExecutor(database, connectionConfig);
        this.directExecutors.set(database, executor);
      }

      // Execute with progress callback
      const result = await executor.execute(
        excelData,
        mappings,
        config,
        {
          batchSize: 1000,
          useTransactions: true,
          rollbackOnError: true,
          timeout: 300000,
          retryFailedRows: false,
          maxRetries: 0,
        },
        (progress: ExecutionProgress) => {
          session.progress = progress;
          this.broadcastProgress(sessionId, progress, onMessage);
        }
      );

      // Mark as complete
      session.status = 'completed';
      session.result = result;

      this.broadcastComplete(sessionId, result, onMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      session.status = 'failed';
      session.error = message;

      this.broadcastError(sessionId, message, onMessage);
    }
  }

  /**
   * Get session status
   */
  getSession(sessionId: string): ConversionSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get current progress
   */
  getProgress(sessionId: string): ExecutionProgress | undefined {
    const session = this.sessions.get(sessionId);
    return session?.progress;
  }

  /**
   * Broadcast progress to subscribers
   */
  private broadcastProgress(
    sessionId: string,
    progress: ExecutionProgress,
    onMessage?: (message: WebSocketMessage) => void
  ): void {
    const message: WebSocketMessage = {
      id: this.generateMessageId(),
      type: 'progress',
      payload: {
        sessionId,
        progress,
      },
      timestamp: Date.now(),
    };

    this.broadcast(message, onMessage);
  }

  /**
   * Broadcast completion
   */
  private broadcastComplete(
    sessionId: string,
    result: any,
    onMessage?: (message: WebSocketMessage) => void
  ): void {
    const message: WebSocketMessage = {
      id: this.generateMessageId(),
      type: 'complete',
      payload: {
        sessionId,
        result,
      },
      timestamp: Date.now(),
    };

    this.broadcast(message, onMessage);
  }

  /**
   * Broadcast error
   */
  private broadcastError(
    sessionId: string,
    error: string,
    onMessage?: (message: WebSocketMessage) => void
  ): void {
    const message: WebSocketMessage = {
      id: this.generateMessageId(),
      type: 'error',
      payload: {
        sessionId,
        error,
      },
      timestamp: Date.now(),
    };

    this.broadcast(message, onMessage);
  }

  /**
   * Broadcast message to all subscribers
   */
  private broadcast(message: WebSocketMessage, onMessage?: (message: WebSocketMessage) => void): void {
    if (onMessage) {
      onMessage(message);
    }

    // In real implementation, would send to actual WebSocket clients
    // For now, this is a callback-based system
  }

  /**
   * Cleanup session
   */
  cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.subscribers.clear();
    }

    this.sessions.delete(sessionId);
    this.subscribers.delete(sessionId);
  }

  /**
   * Cleanup all sessions
   */
  cleanup(): void {
    this.sessions.clear();
    this.subscribers.clear();
  }

  /**
   * Get active sessions count
   */
  getActiveSessionsCount(): number {
    return Array.from(this.sessions.values()).filter(s => s.status === 'processing').length;
  }

  /**
   * Get all sessions
   */
  getAllSessions(): ConversionSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Helper: Generate session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper: Generate message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export for use
export function createWebSocketServer(): WebSocketServer {
  return new WebSocketServer();
}

export { WebSocketServer };
