/**
 * PostgreSQL Utilities
 * Simple, direct PostgreSQL-specific helpers
 * No adapter pattern - PostgreSQL only per roadmap
 */

/**
 * PostgreSQL reserved words that require quoting
 */
export const RESERVED_WORDS = new Set([
  'all', 'analyse', 'analyze', 'and', 'any', 'array', 'as', 'asc',
  'asymmetric', 'authorization', 'binary', 'both', 'case', 'cast',
  'check', 'collate', 'collation', 'column', 'concurrently', 'constraint',
  'create', 'cross', 'current_catalog', 'current_date', 'current_role',
  'current_schema', 'current_time', 'current_timestamp', 'current_user',
  'default', 'deferrable', 'desc', 'distinct', 'do', 'else', 'end',
  'except', 'false', 'fetch', 'for', 'foreign', 'freeze', 'from', 'full',
  'grant', 'group', 'having', 'ilike', 'in', 'initially', 'inner',
  'intersect', 'into', 'is', 'isnull', 'join', 'lateral', 'leading',
  'left', 'like', 'limit', 'localtime', 'localtimestamp', 'natural',
  'not', 'notnull', 'null', 'offset', 'on', 'only', 'or', 'order',
  'outer', 'overlaps', 'placing', 'primary', 'references', 'returning',
  'right', 'select', 'session_user', 'similar', 'some', 'symmetric',
  'table', 'tablesample', 'then', 'to', 'trailing', 'true', 'union',
  'unique', 'user', 'using', 'variadic', 'verbose', 'when', 'where',
  'window', 'with',
]);

/**
 * Check if an identifier needs quoting
 */
export function needsQuoting(name: string): boolean {
  const lowerName = name.toLowerCase();
  
  return (
    RESERVED_WORDS.has(lowerName) ||
    /[A-Z]/.test(name) ||
    /^\d/.test(name) ||
    /[^a-zA-Z0-9_]/.test(name)
  );
}

/**
 * Quote identifier for PostgreSQL
 */
export function quoteIdentifier(name: string): string {
  if (needsQuoting(name)) {
    return `"${name.replace(/"/g, '""')}"`;
  }
  return name;
}

/**
 * Sanitize column name for PostgreSQL
 * Converts spaces to underscores, removes special chars
 */
export function sanitizeColumnName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    || 'column'; // Fallback if empty
}

/**
 * Transaction statements
 */
export const Transaction = {
  begin: () => 'BEGIN;',
  commit: () => 'COMMIT;',
  rollback: () => 'ROLLBACK;',
  savepoint: (name: string) => `SAVEPOINT ${quoteIdentifier(name)};`,
  rollbackTo: (name: string) => `ROLLBACK TO SAVEPOINT ${quoteIdentifier(name)};`,
} as const;
