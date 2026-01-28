# Excel-to-SQL Converter - System Architecture & Design

**Document Version**: 1.0  
**Status**: Production Design  
**Last Updated**: January 28, 2026

---

## Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [Module Breakdown](#module-breakdown)
3. [Data Flow Pipeline](#data-flow-pipeline)
4. [Feature Prioritization Roadmap](#feature-prioritization-roadmap)
5. [API Structure](#api-structure)
6. [CLI Design](#cli-design)
7. [Database-Agnostic Design](#database-agnostic-design)
8. [Error Handling Strategy](#error-handling-strategy)
9. [Scalability Design](#scalability-design)
10. [Security Architecture](#security-architecture)
11. [Production-Grade Workflow](#production-grade-workflow)

---

## System Architecture Overview

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER (React/ShadCN)           │
├─────────────────────────────────────────────────────────────────┤
│  • FileUpload         • ColumnMapping    • SqlPreview            │
│  • DataPreview        • SqlConfigPanel   • ThemeSelector         │
│  • ValidationDisplay  • ErrorReporting   • ExecutionDashboard    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌──────────────┐ ┌─────────────┐ ┌──────────────┐
    │ State Mgmt   │ │ Query Cache │ │ Local Storage│
    │ (React Context)  │(TanStack) │ (Profiles)    │
    └──────────────┘ └─────────────┘ └──────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌───────────────────────────────────────────────────────────────────┐
│                    CORE ENGINE LAYER                              │
├───────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ExcelParser   │  │SchemaDetector│  │ColumnMapper  │             │
│  │• Sheet Read  │  │• Type Detect │  │• Drag-Drop   │             │
│  │• Data Extract│  │• Meta Extract│  │• Auto-Map    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │Validation    │  │Conflict      │  │LookupEngine  │             │
│  │Engine        │  │Resolution    │  │• FK Lookup   │             │
│  │• Type Check  │  │• Skip Mode   │  │• Cross Ref   │             │
│  │• Null Check  │  │• Update Mode │  │• Validation  │             │
│  │• Constraint  │  │• Upsert Mode │  │• Cache       │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │SQL Generator │  │Batch         │  │Transaction   │             │
│  │• Statement   │  │Processor     │  │Manager       │             │
│  │  Build       │  │• Batch Split │  │• Begin/End   │             │
│  │• Value       │  │• Parallel    │  │• Savepoints  │             │
│  │  Escape      │  │• Error ISO   │  │• Rollback    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐                               │
│  │ErrorReporter │  │DryRun Engine │                               │
│  │• Row Errors  │  │• Simulate    │                               │
│  │• Reasons     │  │• Preview     │                               │
│  │• Export      │  │• Validation  │                               │
│  └──────────────┘  └──────────────┘                               │
└───────────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ DB-Agnostic      │ │ Execution        │ │ API Integration  │
│ Adapter Layer    │ │ Manager          │ │                  │
│ • PostgreSQL     │ │ • Direct Exec    │ │ • REST API       │
│ • MySQL          │ │ • File Export    │ │ • GraphQL Ready  │
│ • SQL Server     │ │ • CLI Mode       │ │ • Webhooks       │
└──────────────────┘ └──────────────────┘ └──────────────────┘
        │
        └─────────────────┬──────────────────┐
                          │                  │
                    ┌─────▼────┐      ┌──────▼──────┐
                    │ Database  │      │ File System │
                    │ Connection│      │ (Exports)   │
                    └───────────┘      └─────────────┘
```

### Architecture Principles

- **Layered Design**: Clear separation of concerns (presentation → engine → execution)
- **Database-Agnostic**: Abstraction via adapter pattern
- **Fail-Fast Validation**: Pre-execution error detection
- **Transaction-Safe**: Atomic operations with rollback support
- **Configurable**: Profile-based reusable configurations
- **Extensible**: Plugin architecture for custom validators/handlers
- **Audit Trail**: Complete logging of operations

---

## Module Breakdown

### 1. Frontend Modules (React + ShadCN)

#### 1.1 **FileUpload Component**
```
Location: src/components/FileUpload.tsx
Responsibilities:
  • Accept Excel files (drag-drop + click)
  • File validation (format, size)
  • Progress indication
  • Multi-file support planning

Dependencies:
  • ExcelParser (lib)
  • ValidationEngine
  • FileUploadHandler
```

#### 1.2 **DataPreview Component**
```
Location: src/components/DataPreview.tsx
Responsibilities:
  • Display sheet tabs for multi-sheet Excel files
  • Virtual scroll for large datasets (10K+ rows)
  • Row/column statistics
  • Sample data display (configurable rows)

Dependencies:
  • ExcelData type
  • Virtual scrolling library (or native)
```

#### 1.3 **ColumnMappingPanel Component**
```
Location: src/components/ColumnMappingPanel.tsx
Responsibilities:
  • Drag-drop Excel → Database columns
  • Auto-mapping suggestions
  • Manual mapping override
  • Constraint setup (PK, UK, FK, Nullable)
  • Default value assignment
  • Data type override

Dependencies:
  • ColumnMapping type
  • SchemaDetector
  • DragDropLibrary (react-beautiful-dnd or native)
```

#### 1.4 **SqlConfigPanel Component**
```
Location: src/components/SqlConfigPanel.tsx
Responsibilities:
  • Table name configuration
  • Mode selection (INSERT/UPDATE/UPSERT)
  • Database selection
  • Conflict key configuration
  • Transaction options
  • Batch size settings
  • Option toggles (nullability, trimming, casting)

Dependencies:
  • SqlConfig type
  • DatabaseTypeEnum
```

#### 1.5 **ValidationDisplay Component**
```
Location: src/components/ValidationDisplay.tsx
Responsibilities:
  • Display validation errors/warnings
  • Severity-based coloring
  • Filterable error list
  • Error details expansion
  • Export errors to CSV

Dependencies:
  • ValidationError type
  • ErrorReporter
```

#### 1.6 **SqlPreview Component**
```
Location: src/components/SqlPreview.tsx
Responsibilities:
  • Syntax-highlighted SQL display
  • Copy-to-clipboard
  • Download SQL file
  • Statement count display
  • Execution preview

Dependencies:
  • Prism.js for syntax highlighting
  • SQLGenerator
```

#### 1.7 **ExecutionDashboard Component**
```
Location: src/components/ExecutionDashboard.tsx
Responsibilities:
  • Progress indicator (batch processing)
  • Real-time error streaming
  • Success/failure statistics
  • Rollback option UI
  • Execution logs viewer

Dependencies:
  • ExecutionManager
  • WebSocket for real-time updates
```

### 2. Core Engine Modules (lib/)

#### 2.1 **ExcelParser**
```
Location: src/lib/excel-parser.ts

Class: ExcelParser
Methods:
  + parseFile(file: File): Promise<ExcelData>
  + detectSheet(file: File): Promise<string[]>
  + parseSheet(file: File, sheetName: string): Promise<ExcelData>
  + validateExcelFormat(file: File): ValidationError[]

Features:
  • Multi-sheet detection and navigation
  • Header inference (row 1 by default)
  • Type detection for each column
  • Sample value collection (first 10 rows)
  • Large file support (streaming for 100K+ rows)
  • Encoding detection (UTF-8, ISO-8859-1, etc.)

Dependencies:
  • xlsx library (for parsing)
  • TypeDetector utility
```

#### 2.2 **SchemaDetector**
```
Location: src/lib/schema-detector.ts (NEW)

Class: SchemaDetector
Methods:
  + detectColumnType(values: string[]): PostgresDataType
  + detectConstraints(values: string[]): ConstraintHints
  + suggestColumnName(excelHeader: string): string
  + analyzePattern(values: string[]): PatternAnalysis

Detection Logic:
  • NULL/Empty: boolean, range
  • UUID: regex match
  • ISO Date/Timestamp: date parsing
  • Boolean: specific keywords (yes/no, true/false, 0/1)
  • Integer: numeric + no decimals
  • Decimal: numeric with decimals
  • JSON: JSON.parse attempt
  • Default: TEXT

Confidence Scoring:
  • Calculate confidence per type
  • Suggest alternative types
  • Warn on ambiguous patterns

Dependencies:
  • ValidationEngine for parsing
```

#### 2.3 **ColumnMapper**
```
Location: src/lib/column-mapper.ts (ENHANCEMENT)

Class: ColumnMapper
Methods:
  + autoMapColumns(excelColumns: ExcelColumn[], dbSchema: Schema): ColumnMapping[]
  + suggestMapping(excelCol: ExcelColumn): ColumnMapping[]
  + validateMapping(mappings: ColumnMapping[]): ValidationError[]
  + enrichMappingsWithConstraints(mappings: ColumnMapping[], schema: Schema): ColumnMapping[]

Auto-Mapping Strategy:
  • Levenshtein distance for column name similarity
  • Type matching for detection accuracy
  • Manual override support
  • Template-based mapping (saved profiles)

Dependencies:
  • StringSimilarity utility
  • SchemaDetector
```

#### 2.4 **ValidationEngine**
```
Location: src/lib/validation.ts

Class: ValidationEngine
Methods:
  + validateDataTypes(data: ExcelData, mappings: ColumnMapping[]): ValidationError[]
  + validateDuplicatePrimaryKeys(data: ExcelData, mappings: ColumnMapping[]): ValidationError[]
  + validateNullability(data: ExcelData, mappings: ColumnMapping[]): ValidationError[]
  + validateUniqueConstraints(data: ExcelData, mappings: ColumnMapping[]): ValidationError[]
  + validateForeignKeys(data: ExcelData, mappings: ColumnMapping[], db: Connection): Promise<ValidationError[]>
  + validateAll(data: ExcelData, mappings: ColumnMapping[], db?: Connection): Promise<ValidationError[]>

Validation Rules (Configurable):
  • Type coercion failures
  • NULL in NOT NULL fields
  • PK duplicates or NULLs
  • Unique constraint violations (in data)
  • FK reference validation
  • Custom validation rules (via plugins)

Error Classification:
  • ERROR: Blocks execution
  • WARNING: Non-blocking, informational
  • INFO: Statistics and suggestions

Dependencies:
  • ValidationError type
  • RegEx validators
```

#### 2.5 **ConflictResolutionEngine**
```
Location: src/lib/conflict-resolution.ts (NEW)

Class: ConflictResolutionEngine
Methods:
  + applyStrategy(mode: 'skip' | 'update' | 'upsert'): ConflictHandler
  + skipDuplicates(data: ExcelData, keys: string[]): ExcelData
  + updateOnConflict(data: ExcelData, keys: string[]): ExcelData
  + upsertOnConflict(data: ExcelData, keys: string[]): ExcelData

Modes:
  1. SKIP: Keep existing row, skip new
  2. UPDATE: Replace existing with new
  3. UPSERT: Update if exists, insert if not

Database-Specific Implementations:
  • PostgreSQL: ON CONFLICT DO UPDATE / DO NOTHING
  • MySQL: ON DUPLICATE KEY UPDATE
  • SQL Server: MERGE statement

Dependencies:
  • SqlAdapter
  • Database-specific syntax
```

#### 2.6 **SQLGenerator**
```
Location: src/lib/sql-generator.ts

Class: SqlGenerator
Methods:
  + generateSQL(data: ExcelData, mappings: ColumnMapping[], config: SqlConfig): { sql: string; errors: ValidationError[] }
  + buildInsertStatement(row: any[], mappings: ColumnMapping[], config: SqlConfig): string
  + buildUpdateStatement(row: any[], mappings: ColumnMapping[], config: SqlConfig): string
  + buildUpsertStatement(row: any[], mappings: ColumnMapping[], config: SqlConfig): string
  + escapeString(value: string, database: string): string
  + formatValue(value: any, mapping: ColumnMapping, database: string): string

Features:
  • Transaction wrapping (BEGIN/COMMIT/ROLLBACK)
  • Batch statement grouping
  • Type casting (PostgreSQL :: notation)
  • Encoding normalization
  • Statement validation before output
  • Comment injection prevention

Dependencies:
  • SqlAdapter
  • DatabaseType enum
  • Value formatters
```

#### 2.7 **LookupEngine**
```
Location: src/lib/lookup-engine.ts

Class: LookupEngine
Methods:
  + resolveForeignKey(value: any, fkConfig: FKConfiguration, db: Connection): Promise<string>
  + validateFKValue(value: any, fkConfig: FKConfiguration, db: Connection): Promise<boolean>
  + batchResolveForeignKeys(values: any[], fkConfig: FKConfiguration, db: Connection): Promise<string[]>
  + getCachedValue(key: string): string | null
  + setCacheEntry(key: string, value: string): void

Features:
  • Lazy FK validation
  • Connection pooling for performance
  • In-memory cache (LRU, 10K entries default)
  • Batch lookup optimization
  • Error recovery per record
  • Timeout handling

Dependencies:
  • Database connection
  • CacheManager
```

#### 2.8 **BatchProcessor**
```
Location: src/lib/batch-processor.ts (NEW)

Class: BatchProcessor
Methods:
  + processBatch(data: ExcelData, mappings: ColumnMapping[], config: SqlConfig): Promise<BatchResult>
  + splitIntoBatches(rows: any[][], batchSize: number): any[][][]
  + executeParallel(batches: any[][][], maxConcurrency: number): Promise<BatchResult[]>
  + reportProgress(processed: number, total: number): void
  + isolateErrors(batchResult: BatchResult): ErrorBatch

Features:
  • Configurable batch size (default: 1000)
  • Parallel execution with concurrency limit
  • Per-batch error isolation
  • Progress streaming
  • Checkpoint/resume capability
  • Memory-efficient processing

Error Isolation Strategy:
  • Each batch processed independently
  • Failure in batch N doesn't affect batch N+1
  • Failed rows reported separately
  • Partial success handling

Dependencies:
  • ExecutionManager
  • ProgressReporter
```

#### 2.9 **TransactionManager**
```
Location: src/lib/transaction-manager.ts (NEW)

Class: TransactionManager
Methods:
  + beginTransaction(): Promise<void>
  + createSavepoint(name: string): Promise<void>
  + releaseSavepoint(name: string): Promise<void>
  + rollbackToSavepoint(name: string): Promise<void>
  + commitTransaction(): Promise<void>
  + rollbackTransaction(): Promise<void>
  + executeWithinTransaction(fn: () => Promise<any>): Promise<any>

Features:
  • Automatic transaction management
  • Savepoint support per batch
  • Automatic rollback on error
  • Nested transaction simulation (via savepoints)
  • Connection pooling coordination
  • Timeout handling

Error Recovery:
  • On statement error: Save to error log, continue
  • On batch error: Rollback to savepoint, skip batch
  • On critical error: Full rollback, report to user

Dependencies:
  • Database adapter
  • Connection pool
```

#### 2.10 **ExecutionManager**
```
Location: src/lib/execution-manager.ts (NEW)

Class: ExecutionManager
Methods:
  + executeSQL(sql: string, config: SqlConfig, dryRun: boolean = false): Promise<ExecutionResult>
  + executeDirectly(db: Connection, mappings: ColumnMapping[], config: SqlConfig): Promise<ExecutionResult>
  + executeWithFile(sql: string, filePath: string): void
  + validateDryRun(sql: string, config: SqlConfig): Promise<DryRunResult>
  + streamExecution(sql: string, config: SqlConfig): AsyncIterator<ExecutionProgress>

Modes:
  1. DRY_RUN: Parse and validate SQL without execution
  2. FILE_EXPORT: Write to .sql file
  3. DIRECT_EXECUTION: Execute against live database
  4. PREVIEW_DIFF: Show before/after data

Execution Flow:
  1. Pre-execution validation
  2. Connection verification
  3. Transaction initialization
  4. Statement execution (with error handling)
  5. Result collection
  6. Transaction finalization
  7. Reporting

Dependencies:
  • Database adapters
  • TransactionManager
  • ErrorReporter
  • ProgressReporter
```

#### 2.11 **ErrorReporter**
```
Location: src/lib/error-reporter.ts (NEW)

Class: ErrorReporter
Methods:
  + classifyError(error: Error, context: ExecutionContext): ErrorClassification
  + generateErrorReport(errors: ValidationError[]): ErrorReport
  + suggestAutoFix(error: ValidationError): SuggestionResult
  + exportErrors(errors: ValidationError[], format: 'csv' | 'json'): string
  + streamErrors(errors: AsyncIterator<ValidationError>): AsyncIterator<ErrorReport>

Error Classification:
  • DATA_TYPE_MISMATCH
  • NULL_CONSTRAINT_VIOLATION
  • PK_DUPLICATE
  • FK_NOT_FOUND
  • UNIQUE_CONSTRAINT_VIOLATION
  • CONNECTION_ERROR
  • SYNTAX_ERROR
  • TIMEOUT_ERROR
  • CUSTOM_VALIDATION_FAILURE

Auto-Fix Suggestions:
  • Type coercion hints
  • NULL handling strategies
  • Duplicate resolution options
  • Re-mapping suggestions
  • Data cleaning scripts

Dependencies:
  • ErrorClassifier
  • SuggestionEngine
```

### 3. Database Adapter Layer

#### 3.1 **BaseAdapter (Abstract)**
```
Location: src/lib/adapters/base-adapter.ts

Class: BaseDatabaseAdapter (Abstract)
Methods:
  # Connection
  + connect(config: ConnectionConfig): Promise<Connection>
  + disconnect(): Promise<void>
  + validateConnection(): Promise<boolean>

  # SQL Syntax
  + beginTransaction(): string
  + commitTransaction(): string
  + rollbackTransaction(): string
  + createSavepoint(name: string): string
  + releaseSavepoint(name: string): string

  # Conflict Resolution
  + buildConflictClause(mode: ConflictMode, conflictKeys: string[]): string
  + buildUpsertStatement(table: string, columns: string[], conflictKeys: string[]): string

  # Schema Operations
  + getTableSchema(tableName: string): Promise<Schema>
  + listTables(): Promise<string[]>
  + validateTableExists(tableName: string): Promise<boolean>

  # Type Mapping
  + mapExcelTypeToDb(excelType: PostgresDataType): string
  + validateTypeCoercion(value: string, dbType: string): boolean

Properties:
  - name: 'postgresql' | 'mysql' | 'sqlserver'
  - supportsUpsert: boolean
  - supportsJsonb: boolean
  - supportsCastSyntax: boolean
  - maxBatchSize: number
```

#### 3.2 **PostgreSQLAdapter**
```
Location: src/lib/adapters/postgresql-adapter.ts

Extends: BaseDatabaseAdapter
Implements:
  • PostgreSQL 12+
  • JSONB support
  • UUID native type
  • ON CONFLICT clause
  • Range types
  • Array types (future)

Type Mappings:
  • TEXT/VARCHAR → TEXT
  • INTEGER/BIGINT → INTEGER/BIGINT
  • DECIMAL → NUMERIC
  • BOOLEAN → BOOLEAN
  • DATE → DATE
  • TIMESTAMP → TIMESTAMP
  • TIMESTAMPTZ → TIMESTAMPTZ
  • JSON/JSONB → JSONB
  • UUID → UUID

Conflict Resolution:
  • ON CONFLICT (col) DO NOTHING
  • ON CONFLICT (col) DO UPDATE SET col = EXCLUDED.col

Features:
  • Native UUID type
  • Array aggregates
  • Inheritance (not used currently)
```

#### 3.3 **MySQLAdapter**
```
Location: src/lib/adapters/mysql-adapter.ts

Extends: BaseDatabaseAdapter
Implements:
  • MySQL 8.0+
  • JSON support
  • ON DUPLICATE KEY UPDATE

Type Mappings:
  • TEXT/VARCHAR → VARCHAR(255) (configurable)
  • INTEGER/BIGINT → INT/BIGINT
  • DECIMAL → DECIMAL(10,2) (configurable)
  • BOOLEAN → TINYINT(1)
  • DATE → DATE
  • TIMESTAMP → TIMESTAMP
  • JSON → JSON
  • UUID → CHAR(36)

Conflict Resolution:
  • IGNORE syntax
  • ON DUPLICATE KEY UPDATE

Features:
  • VARCHAR length management
  • DECIMAL precision/scale
  • Boolean emulation
  • UUID as string
```

#### 3.4 **SQLServerAdapter**
```
Location: src/lib/adapters/sqlserver-adapter.ts

Extends: BaseDatabaseAdapter
Implements:
  • SQL Server 2019+
  • MERGE statement
  • JSON support

Type Mappings:
  • TEXT/VARCHAR → VARCHAR(MAX) / VARCHAR(255)
  • INTEGER/BIGINT → INT / BIGINT
  • DECIMAL → DECIMAL(18,2)
  • BOOLEAN → BIT
  • DATE → DATE
  • TIMESTAMP → DATETIME2
  • JSON → NVARCHAR(MAX)
  • UUID → UNIQUEIDENTIFIER

Conflict Resolution:
  • MERGE statement with WHEN MATCHED/NOT MATCHED

Features:
  • IDENTITY handling
  • MERGE syntax
  • VARCHAR(MAX) for JSON
```

---

## Data Flow Pipeline

### Complete Workflow Flow

```
USER INTERACTION                    INTERNAL PROCESSING
─────────────────────────────────────────────────────────

1. UPLOAD PHASE
  User: Upload Excel File
       │
       ▼
  FileUpload Component
       │
       ├─► Validate File (format, size)
       │
       ├─► Read Excel (ExcelParser)
       │   └─► Detect Sheets
       │   └─► Infer Headers
       │   └─► Sample Rows
       │
       ▼
  DataPreview Component (Display)
       │
       └─► State: excelData, sheets


2. DETECTION & SCHEMA PHASE
  User: (Auto or Manual selection)
       │
       ▼
  SchemaDetector
       │
       ├─► For Each Column:
       │   ├─► Analyze Sample Values
       │   ├─► Detect Data Type
       │   ├─► Detect Nullability
       │   ├─► Detect Constraint Hints
       │   └─► Calculate Confidence
       │
       ▼
  ExcelColumn[] created
       │
       └─► State: columns


3. MAPPING PHASE
  User: Drag-Drop Excel → DB Columns
       │
       ├─► Manual Mapping
       │   └─► ColumnMappingPanel (UI)
       │
       ├─► Or Auto-Mapping
       │   └─► ColumnMapper.autoMapColumns()
       │       ├─► Suggest DB columns (name matching)
       │       ├─► Type compatibility check
       │       └─► Confidence scoring
       │
       ▼
  User: Configure Constraints
       │
       ├─► Mark Primary Key(s)
       ├─► Mark Unique Constraints
       ├─► Mark Foreign Keys
       ├─► Set Nullability
       ├─► Set Default Values
       │
       ▼
  ColumnMapping[] + Schema Info
       │
       └─► State: mappings


4. CONFIGURATION PHASE
  SqlConfigPanel
       │
       ├─► Table Name
       ├─► Mode (INSERT/UPDATE/UPSERT)
       ├─► Database Type
       ├─► Conflict Keys (for UPSERT)
       ├─► Conflict Mode (skip/update/upsert)
       ├─► Options:
       │   ├─► Wrap in Transaction
       │   ├─► Ignore NULL Values
       │   ├─► Trim Strings
       │   ├─► Cast Types
       │   └─► Batch Size (1000 default)
       │
       ▼
  SqlConfig created
       │
       └─► State: config


5. VALIDATION PHASE
  ValidationEngine.validateAll()
       │
       ├─► validateDataTypes()
       │   └─► Check type conversions
       │
       ├─► validateNullability()
       │   └─► NOT NULL fields with NULLs
       │
       ├─► validateDuplicatePrimaryKeys()
       │   └─► Find duplicate PK values
       │
       ├─► validateUniqueConstraints()
       │   └─► Check for duplicates in UK columns
       │
       ├─► validateForeignKeys() [Optional, if DB conn]
       │   └─► Verify FK references exist
       │
       ▼
  ValidationError[] collected
       │
       ├─► If ERRORs exist:
       │   └─► Stop, show ValidationDisplay
       │
       ├─► If only WARNINGs:
       │   └─► Continue with user confirmation
       │
       └─► State: errors


6. PREVIEW PHASE
  SqlGenerator.generateSQL()
       │
       ├─► For Each Row:
       │   ├─► Format values per data type
       │   ├─► Escape strings (DB-specific)
       │   ├─► Apply conflict mode
       │   └─► Build SQL statement
       │
       ├─► Wrap in Transaction (if option)
       │
       ├─► Add Conflict Clauses (if UPSERT)
       │
       ▼
  SQL String + Errors collected
       │
       ├─► SqlPreview Component
       │   ├─► Syntax highlighting
       │   ├─► Copy/Download options
       │   └─► Statement count
       │
       └─► State: sql


7. EXECUTION PHASE (User selects Execute)
  ExecutionManager.executeSQL()
       │
       ├─► DRY_RUN Mode:
       │   ├─► Parse SQL
       │   ├─► Validate syntax
       │   └─► Report preview (no execution)
       │
       ├─► FILE_EXPORT Mode:
       │   ├─► Write SQL to file
       │   └─► Download to user
       │
       ├─► DIRECT_EXECUTION Mode:
       │   │
       │   ├─► Validate connection
       │   │
       │   ├─► TransactionManager.beginTransaction()
       │   │
       │   ├─► BatchProcessor.processBatch()
       │   │   ├─► Split into batches (size from config)
       │   │   │
       │   │   ├─► For Each Batch:
       │   │   │   ├─► Create Savepoint
       │   │   │   ├─► Execute SQL statements
       │   │   │   ├─► Collect results
       │   │   │   │
       │   │   │   ├─► On Error:
       │   │   │   │   ├─► Rollback to Savepoint
       │   │   │   │   ├─► Log batch error
       │   │   │   │   ├─► Continue (if isolation)
       │   │   │   │
       │   │   │   └─► Report progress
       │   │   │
       │   │   └─► Collect all batch results
       │   │
       │   ├─► TransactionManager.commitTransaction()
       │   │
       │   └─► ExecutionDashboard (real-time feedback)
       │       ├─► Progress %
       │       ├─► Rows processed
       │       ├─► Errors encountered
       │       └─► Time elapsed
       │
       ▼
  ExecutionResult
       │
       ├─► Success Case:
       │   ├─► Show confirmation
       │   ├─► Rows affected count
       │   ├─► Execution time
       │   └─► Option to export report
       │
       ├─► Partial Success Case:
       │   ├─► Show success count
       │   ├─► Show error count
       │   ├─► Option to export failed rows
       │   └─► Option to rollback
       │
       └─► Failure Case:
           ├─► Show error details
           ├─► Option to view full logs
           ├─► Option to rollback
           └─► Suggest remediation


8. REPORTING PHASE
  ErrorReporter.generateErrorReport()
       │
       ├─► Classify errors
       ├─► Generate suggestions
       ├─► Export to CSV/JSON
       └─► Archive for audit trail
```

### State Management Architecture

```
React Context (ThemeContext)
├─ selectedTheme: string
└─ toggleTheme: () => void

ConversionContext (to be created)
├─ State:
│  ├─ step: 'upload' | 'mapping' | 'config' | 'preview' | 'execution'
│  ├─ excelData: ExcelData | null
│  ├─ columns: ExcelColumn[]
│  ├─ mappings: ColumnMapping[]
│  ├─ config: SqlConfig
│  ├─ sql: string
│  ├─ errors: ValidationError[]
│  ├─ executionResult: ExecutionResult | null
│  └─ isLoading: boolean
│
└─ Actions:
   ├─ setExcelData(data: ExcelData)
   ├─ setMappings(mappings: ColumnMapping[])
   ├─ setConfig(config: SqlConfig)
   ├─ setSQL(sql: string)
   ├─ setErrors(errors: ValidationError[])
   ├─ executeConversion(mode: ExecutionMode)
   └─ resetState()

Local Storage Profiles
├─ mappingTemplates: { name: string; mappings: ColumnMapping[] }[]
├─ validationRules: { name: string; rules: ValidationRule[] }[]
└─ connectionProfiles: { name: string; config: ConnectionConfig }[]
```

---

## Feature Prioritization Roadmap

### MVP (Phase 1) - Foundation [Weeks 1-4]

**Goal**: Core single-database conversion with basic validation

#### 1.1 Core Features
- [x] Excel file upload (single sheet)
- [x] Data preview (first 100 rows)
- [x] Basic schema detection (type inference)
- [x] Manual column mapping (drag-drop)
- [ ] Basic validation (required fields, type mismatch)
- [ ] SQL generation (INSERT only)
- [ ] PostgreSQL support
- [ ] Dry-run preview

#### 1.2 UI Components
- [x] FileUpload component
- [x] DataPreview component
- [ ] ColumnMappingPanel (simple version)
- [ ] SqlConfigPanel (basic)
- [ ] SqlPreview component
- [ ] ValidationDisplay component

#### 1.3 Backend Modules
- [x] ExcelParser
- [ ] SchemaDetector (basic)
- [ ] ValidationEngine (basic)
- [ ] SQLGenerator (INSERT only)
- [ ] PostgreSQLAdapter

#### 1.4 Testing
- [ ] Parser unit tests
- [ ] Type detection tests
- [ ] SQL generation tests
- [ ] E2E workflow tests

---

### Phase 2 - Multi-Database & Conflict Handling [Weeks 5-8]

**Goal**: Production-ready single-file conversion with conflict resolution

#### 2.1 Database Support
- [ ] MySQL adapter
- [ ] SQL Server adapter
- [ ] Connection pooling
- [ ] Connection validation

#### 2.2 Advanced Features
- [ ] Multi-sheet Excel support
- [ ] Auto-mapping (name similarity)
- [ ] Mapping templates (save/load)
- [ ] Constraint configuration (PK, UK, FK, nullable)
- [ ] Conflict modes (skip/update/upsert)
- [ ] Transaction safety (BEGIN/COMMIT/ROLLBACK)
- [ ] Batch processing (configurable batch size)
- [ ] Savepoint support per batch
- [ ] Error isolation per batch

#### 2.3 Validation Enhanced
- [ ] Duplicate PK detection
- [ ] Unique constraint validation
- [ ] Nullability checks
- [ ] Foreign key validation (DB-based)
- [ ] Custom validation rules (pluggable)

#### 2.4 Execution Modes
- [ ] Direct DB execution
- [ ] File export (SQL file)
- [ ] Preview diff (before/after)
- [ ] Real-time progress streaming

#### 2.5 Error Handling
- [ ] Row-level error reporting
- [ ] Error classification
- [ ] Auto-fix suggestions
- [ ] Failed row export (CSV)
- [ ] Complete error report generation

#### 2.6 Testing
- [ ] MySQL/SQL Server tests
- [ ] Transaction tests
- [ ] Conflict resolution tests
- [ ] Error handling tests
- [ ] Integration tests

---

### Phase 3 - Enterprise Features [Weeks 9-12]

**Goal**: Production-grade with automation, API, CLI, and advanced capabilities

#### 3.1 Data Management
- [ ] Batch file uploads (drag-drop multiple files)
- [ ] Large file support (100K+ rows with streaming)
- [ ] Incremental import (resume on failure)
- [ ] Data cleanup rules (trimming, case conversion, etc.)
- [ ] Lookup engine (FK resolution with caching)

#### 3.2 Configuration Management
- [ ] Save mapping templates (reusable profiles)
- [ ] Save validation rule sets
- [ ] Environment configs (dev/staging/prod)
- [ ] Connection profile management
- [ ] Import history tracking

#### 3.3 API & Integration
- [ ] REST API endpoints for conversion
- [ ] GraphQL API (optional)
- [ ] Webhook support for completion notifications
- [ ] Direct database integration UI
- [ ] Authentication/authorization

#### 3.4 CLI Tool
- [ ] Command-line interface
- [ ] Pipeline support (Excel → SQL → DB)
- [ ] CI/CD friendly output formats
- [ ] Configuration file support (YAML/JSON)
- [ ] Scheduled import support

#### 3.5 Advanced Features
- [ ] Reconciliation engine (data freshness checks)
- [ ] Audit trail (full operation logging)
- [ ] Data lineage tracking
- [ ] Performance optimization (parallel processing)
- [ ] Custom validator plugins
- [ ] Custom handler hooks

#### 3.6 Security & Compliance
- [ ] SQL injection protection (parameterized queries)
- [ ] Encoding control (UTF-8, etc.)
- [ ] Secrets management (encrypted credentials)
- [ ] Access control (RBAC)
- [ ] Compliance reporting
- [ ] Data masking for sensitive fields

#### 3.7 Monitoring & Logging
- [ ] Centralized logging dashboard
- [ ] Performance metrics
- [ ] Error aggregation
- [ ] Audit trail viewer
- [ ] Health check endpoints

#### 3.8 Testing & Quality
- [ ] Load testing (10K+ row performance)
- [ ] Stress testing (concurrent conversions)
- [ ] Security testing (SQL injection, etc.)
- [ ] Accessibility testing (WCAG 2.1 AA)
- [ ] Performance profiling

---

### Phase 4 - Advanced Automation [Future]

**Goal**: Enterprise automation and advanced data operations

#### 4.1 Features
- [ ] Scheduled imports (cron-like)
- [ ] Data transformation rules (custom logic)
- [ ] Master data management (MDM) integration
- [ ] Data quality monitoring
- [ ] Automated remediation workflows
- [ ] Version control for imports (Git-like)
- [ ] Rollback to previous state
- [ ] Multi-database federation
- [ ] Replication support (master-slave)

---

## API Structure

### REST API Endpoints

```
BASE_URL: /api/v1

────────────────────────────────────────────────────

FILE OPERATIONS
────────────────────────────────────────────────────

POST /files/upload
  Upload Excel file
  Request:
    - multipart/form-data
    - file: File
  Response: {
    fileId: string;
    sheets: string[];
    metadata: {
      fileName: string;
      uploadedAt: ISO8601;
      rowCount: number;
    }
  }

GET /files/{fileId}/sheets/{sheetName}
  Get sheet data with pagination
  Query:
    - limit: number (default: 100)
    - offset: number (default: 0)
  Response: {
    data: ExcelData;
    pageInfo: { limit, offset, total }
  }

GET /files/{fileId}/schema
  Get detected schema
  Response: {
    columns: ExcelColumn[];
    suggestions: SchemaSuggestion[]
  }


────────────────────────────────────────────────────

CONVERSION & MAPPING
────────────────────────────────────────────────────

POST /conversions
  Create new conversion session
  Request: {
    fileId: string;
    sheetName: string;
    tableName: string;
    database: DatabaseType;
  }
  Response: {
    conversionId: string;
    state: ConversionState
  }

PUT /conversions/{conversionId}/mappings
  Update column mappings
  Request: {
    mappings: ColumnMapping[]
  }
  Response: {
    mappings: ColumnMapping[];
    validation: ValidationError[]
  }

PUT /conversions/{conversionId}/config
  Update SQL config
  Request: {
    config: SqlConfig;
    mode?: 'INSERT' | 'UPDATE' | 'UPSERT'
  }
  Response: {
    config: SqlConfig;
    validation: ValidationError[]
  }

GET /conversions/{conversionId}/preview
  Get SQL preview
  Query:
    - limit: number (default: 100 statements)
  Response: {
    sql: string;
    statementCount: number;
    estimatedRows: number
  }

POST /conversions/{conversionId}/validate
  Run validation
  Request: {
    includeFK?: boolean;
    dbConnection?: ConnectionConfig;
  }
  Response: {
    errors: ValidationError[];
    warnings: ValidationError[];
    duration: number (ms)
  }


────────────────────────────────────────────────────

EXECUTION
────────────────────────────────────────────────────

POST /conversions/{conversionId}/execute
  Execute conversion
  Request: {
    mode: 'dry-run' | 'execute' | 'export';
    database?: ConnectionConfig;
    options?: {
      rollbackOnError: boolean;
      batchSize: number;
    }
  }
  Response: {
    executionId: string;
    status: 'pending' | 'running' | 'success' | 'partial' | 'failed';
    progress: {
      processed: number;
      total: number;
      percent: number
    }
  }

GET /conversions/{conversionId}/execute/{executionId}
  Get execution status (polling)
  Response: {
    status: ExecutionStatus;
    progress: ProgressInfo;
    errors: ErrorInfo[];
    result?: ExecutionResult
  }

WS /conversions/{conversionId}/execute/{executionId}/stream
  WebSocket for real-time execution updates
  Message: {
    type: 'progress' | 'error' | 'complete';
    payload: {...}
  }

GET /conversions/{conversionId}/execute/{executionId}/export
  Export execution result
  Query:
    - format: 'sql' | 'json' | 'csv'
  Response: File (streamed)


────────────────────────────────────────────────────

PROFILES & TEMPLATES
────────────────────────────────────────────────────

GET /profiles
  List all saved profiles
  Response: {
    mappingProfiles: MappingProfile[];
    validationProfiles: ValidationProfile[];
    connectionProfiles: ConnectionProfile[]
  }

POST /profiles/mapping
  Save mapping template
  Request: {
    name: string;
    mappings: ColumnMapping[];
    description?: string
  }
  Response: { id: string; ... }

GET /profiles/mapping/{profileId}
  Get mapping profile
  Response: MappingProfile

PUT /profiles/mapping/{profileId}
  Update mapping profile
  Request: { name, mappings, description }
  Response: MappingProfile

DELETE /profiles/mapping/{profileId}
  Delete mapping profile
  Response: { success: boolean }

POST /profiles/connection
  Save connection profile
  Request: {
    name: string;
    database: DatabaseType;
    config: {
      host: string;
      port: number;
      username: string;
      password: string (encrypted);
      database: string
    }
  }
  Response: { id: string; ... }

PUT /profiles/connection/{profileId}/test
  Test database connection
  Response: { connected: boolean; error?: string }


────────────────────────────────────────────────────

MONITORING & LOGS
────────────────────────────────────────────────────

GET /executions
  List recent executions
  Query:
    - limit: number (default: 50)
    - status?: string
    - from?: ISO8601
    - to?: ISO8601
  Response: {
    executions: ExecutionSummary[];
    total: number
  }

GET /executions/{executionId}/logs
  Get execution logs
  Query:
    - level?: 'debug' | 'info' | 'warn' | 'error'
    - limit?: number
  Response: {
    logs: LogEntry[];
    total: number
  }

GET /executions/{executionId}/errors/export
  Export errors
  Query:
    - format: 'csv' | 'json'
  Response: File (streamed)


────────────────────────────────────────────────────

HEALTH & SYSTEM
────────────────────────────────────────────────────

GET /health
  System health check
  Response: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    version: string;
    timestamp: ISO8601
  }

GET /version
  Get API version
  Response: {
    api: string;
    schema: string;
    build: string
  }
```

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_FAILED" | "DB_ERROR" | "CONVERSION_ERROR" | "INTERNAL_ERROR",
    "message": "Human-readable error message",
    "details": {
      "field": "fieldName",
      "reason": "Detailed reason",
      "suggestion": "How to fix"
    },
    "requestId": "UUID for tracking"
  }
}
```

---

## CLI Design

### Command Structure

```bash
excel-to-sql [command] [options]

────────────────────────────────────────────────────

BASIC USAGE
────────────────────────────────────────────────────

# Preview Excel file
excel-to-sql preview <file.xlsx> \
  --sheet "Sheet1" \
  --limit 10

# Generate SQL
excel-to-sql convert <file.xlsx> \
  --table users \
  --database postgres \
  --mappings <mapping.json> \
  --output output.sql

# Execute directly
excel-to-sql execute <file.xlsx> \
  --table users \
  --database postgres \
  --connection-profile prod \
  --dry-run false \
  --batch-size 1000

# Validate only
excel-to-sql validate <file.xlsx> \
  --mappings <mapping.json> \
  --database postgres \
  --connection-profile dev


────────────────────────────────────────────────────

PROFILE MANAGEMENT
────────────────────────────────────────────────────

# List profiles
excel-to-sql profile list \
  --type mapping | connection | validation

# Save mapping profile
excel-to-sql profile save-mapping \
  --name "user_import" \
  --mappings <mapping.json>

# Use profile
excel-to-sql convert <file.xlsx> \
  --mapping-profile "user_import" \
  --connection-profile prod

# Manage connections
excel-to-sql connection add postgres-prod \
  --host localhost \
  --port 5432 \
  --database mydb \
  --user admin \
  --password-file .env

excel-to-sql connection test postgres-prod


────────────────────────────────────────────────────

BATCH & AUTOMATION
────────────────────────────────────────────────────

# Batch processing
excel-to-sql batch <directory>/*.xlsx \
  --mapping-profile "standard" \
  --connection-profile prod \
  --parallel 4

# Pipeline execution
excel-to-sql pipeline \
  --config pipeline.yaml \
  --execute true \
  --on-error rollback | continue | stop

# Schedule import
excel-to-sql schedule add \
  --name "daily_users" \
  --file users/*.xlsx \
  --cron "0 2 * * *" \
  --profile "user_import"

excel-to-sql schedule list
excel-to-sql schedule run daily_users


────────────────────────────────────────────────────

ADVANCED OPTIONS
────────────────────────────────────────────────────

# Common Options
--database <postgres|mysql|sqlserver>  # DB type
--table <name>                          # Target table
--mode <INSERT|UPDATE|UPSERT>           # DML mode
--conflict-key <col1,col2>              # Upsert keys
--dry-run [true|false]                  # Preview only

# Batch Processing
--batch-size <number>                   # Rows per batch (default: 1000)
--parallel <number>                     # Max concurrent batches (default: 4)
--on-error <rollback|continue|stop>     # Error strategy

# Validation
--validate-only                         # Stop after validation
--skip-validation                       # Skip validation
--fk-validation                         # Enable FK checks

# Output
--output <file>                         # Output file path
--format <sql|json|csv>                 # Output format
--report <file>                         # Error report file

# Configuration
--config <file.yaml|file.json>          # Config file
--profile <name>                        # Use saved profile
--connection-profile <name>             # Connection profile

# Logging
--log-level <debug|info|warn|error>     # Log level
--log-file <path>                       # Log file

# Advanced
--encoding <UTF-8|ISO-8859-1>           # File encoding
--trim-strings [true|false]             # Trim whitespace
--cast-types [true|false]               # Cast types
--null-handling <keep|skip|replace>     # NULL handling
--custom-rules <file.json>              # Custom validators
```

### Configuration File Examples

#### YAML Config
```yaml
# pipeline.yaml
conversion:
  database: postgres
  tableName: users
  mode: upsert
  conflictKeys:
    - email
  mappings:
    - excelColumn: "First Name"
      pgColumn: "first_name"
      dataType: TEXT
      isPrimaryKey: false
      isNullable: true
    - excelColumn: "Email"
      pgColumn: "email"
      dataType: TEXT
      isPrimaryKey: false
      isNullable: false
      isUnique: true

execution:
  batchSize: 1000
  parallelism: 4
  wrapInTransaction: true
  onError: rollback

connection:
  profile: prod

output:
  format: sql
  file: output.sql
  reportFile: errors.csv
```

#### JSON Config
```json
{
  "conversion": {
    "database": "mysql",
    "tableName": "orders",
    "mode": "INSERT",
    "mappings": [
      {
        "excelColumn": "Order ID",
        "pgColumn": "order_id",
        "dataType": "BIGINT",
        "isPrimaryKey": true,
        "isNullable": false,
        "isUnique": true
      }
    ]
  },
  "execution": {
    "batchSize": 500,
    "onError": "continue"
  },
  "output": {
    "format": "json",
    "file": "result.json"
  }
}
```

---

## Database-Agnostic Design

### Adapter Pattern Implementation

```
┌─────────────────────────────────────────┐
│         Core Application Logic          │
│  (Type Detection, Validation, etc.)    │
└──────────────────┬──────────────────────┘
                   │
                   │ Depends on
                   ▼
          ┌────────────────┐
          │ DatabaseAdapter│ (Interface)
          │   Interface    │
          └────────┬───────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
        ▼          ▼          ▼
    ┌────────┐ ┌────────┐ ┌──────────┐
    │  PG    │ │ MySQL  │ │ SQL Server│
    │Adapter │ │Adapter │ │ Adapter   │
    └────┬───┘ └────┬───┘ └────┬──────┘
         │          │          │
         ▼          ▼          ▼
    PostgreSQL    MySQL     SQL Server
```

### Abstraction Layers

#### 1. Type Mapping Layer
```typescript
// Application Code
const dbType = adapter.mapExcelTypeToDb('INTEGER');

// Adapter Implementation
PostgreSQLAdapter.mapExcelTypeToDb('INTEGER') → 'INTEGER'
MySQLAdapter.mapExcelTypeToDb('INTEGER') → 'INT'
SQLServerAdapter.mapExcelTypeToDb('INTEGER') → 'INT'
```

#### 2. Syntax Layer
```typescript
// Application Code
const beginTxn = adapter.beginTransaction();

// Adapter Implementation
PostgreSQLAdapter.beginTransaction() → 'BEGIN TRANSACTION;'
MySQLAdapter.beginTransaction() → 'START TRANSACTION;'
SQLServerAdapter.beginTransaction() → 'BEGIN TRANSACTION;'
```

#### 3. Conflict Resolution Layer
```typescript
// Application Code
const clause = adapter.buildConflictClause('upsert', ['email']);

// Adapter Implementation
PostgreSQL → 'ON CONFLICT (email) DO UPDATE SET ...'
MySQL → 'ON DUPLICATE KEY UPDATE ...'
SQL Server → 'MERGE ... WHEN MATCHED THEN UPDATE ...'
```

#### 4. Schema Operations Layer
```typescript
// Application Code
const schema = await adapter.getTableSchema('users');

// Adapter Implementation
PostgreSQL → pg.query('SELECT ... FROM information_schema...')
MySQL → mysql.query('SHOW COLUMNS FROM users')
SQL Server → mssql.query('SELECT * FROM INFORMATION_SCHEMA...')
```

### Adding a New Database

```typescript
// 1. Create new adapter
export class CustomDatabaseAdapter extends BaseDatabaseAdapter {
  name = 'customdb';
  supportsUpsert = true;
  
  // Implement abstract methods
  mapExcelTypeToDb(excelType: PostgresDataType): string { }
  buildInsertStatement(table: string, columns: string[]): string { }
  buildConflictClause(mode: ConflictMode, keys: string[]): string { }
  // ... etc
}

// 2. Register in adapter factory
export function getAdapter(database: DatabaseType): BaseDatabaseAdapter {
  switch(database) {
    case 'postgresql':
      return new PostgreSQLAdapter();
    case 'mysql':
      return new MySQLAdapter();
    case 'sqlserver':
      return new SQLServerAdapter();
    case 'customdb':
      return new CustomDatabaseAdapter();  // NEW
    default:
      throw new Error(`Unsupported database: ${database}`);
  }
}

// 3. Update type definitions
export type DatabaseType = 'postgresql' | 'mysql' | 'sqlserver' | 'customdb';
```

---

## Error Handling Strategy

### Error Classification System

```
┌─────────────────────────────────────┐
│         Raw Error Occurs            │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌──────────────┐
        │  Error Caught│
        └──────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
    ▼          ▼          ▼
┌──────┐  ┌──────┐  ┌────────┐
│ Type │  │Class │  │Context │
│Check │  │ify   │  │Extract │
└──────┘  └──────┘  └────────┘
               │
               ▼
    ┌──────────────────────┐
    │ErrorClassification   │
    │ + Reason             │
    │ + Suggestion         │
    │ + Affected Data      │
    └──────────────────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
 Report    Suggest     Recovery
```

### Error Types & Handling

```
1. DATA VALIDATION ERRORS
   ├─ Type Mismatch
   │  ├─ Cause: Value cannot be coerced to target type
   │  ├─ Action: Flag row as error, suggest type override
   │  └─ Recovery: Manual type override or data cleaning
   │
   ├─ NULL Constraint Violation
   │  ├─ Cause: NOT NULL column with NULL value
   │  ├─ Action: Flag row as error
   │  └─ Recovery: Provide default or skip row
   │
   ├─ Duplicate Primary Key
   │  ├─ Cause: Multiple rows with same PK
   │  ├─ Action: Flag rows, suggest conflict mode
   │  └─ Recovery: Skip/Update/Upsert strategy
   │
   └─ Unique Constraint Violation
      ├─ Cause: Duplicate unique column value
      ├─ Action: Flag rows
      └─ Recovery: Update/Upsert strategy

2. CONSTRAINT ERRORS
   ├─ Foreign Key Not Found
   │  ├─ Cause: Referenced record doesn't exist
   │  ├─ Action: Flag row, try to fix via lookup
   │  └─ Recovery: Create missing reference or skip
   │
   └─ Referential Integrity
      ├─ Cause: Cascading delete conflict
      ├─ Action: Flag row
      └─ Recovery: Manual data adjustment

3. DATABASE ERRORS
   ├─ Connection Error
   │  ├─ Cause: Cannot connect to database
   │  ├─ Action: Stop execution, show error
   │  └─ Recovery: Check connection, retry
   │
   ├─ Timeout Error
   │  ├─ Cause: Query took too long
   │  ├─ Action: Cancel statement, rollback batch
   │  └─ Recovery: Reduce batch size, retry
   │
   ├─ Syntax Error
   │  ├─ Cause: Invalid SQL generated
   │  ├─ Action: Show generated SQL, report line
   │  └─ Recovery: Debug SQL generator or mappings
   │
   └─ Permission Error
      ├─ Cause: User lacks INSERT/UPDATE rights
      ├─ Action: Show permission error
      └─ Recovery: Grant permissions, retry

4. SYSTEM ERRORS
   ├─ Out of Memory
   │  ├─ Cause: Too much data in memory
   │  ├─ Action: Stop, show memory stats
   │  └─ Recovery: Process in smaller batches
   │
   ├─ Disk Full
   │  ├─ Cause: Cannot write output/logs
   │  ├─ Action: Stop, report disk space
   │  └─ Recovery: Free disk space, retry
   │
   └─ Internal Error
      ├─ Cause: Unexpected bug
      ├─ Action: Log full stack trace, show user error
      └─ Recovery: Report to support, check logs
```

### Error Handling in Execution Pipeline

```
Phase 1: VALIDATION (Pre-execution)
├─ Data type validation
├─ NULL checks
├─ PK/UK duplicate detection
├─ FK validation (optional)
└─ On Error → STOP, Show all errors before execution

Phase 2: CONVERSION (SQL Generation)
├─ Value formatting
├─ SQL statement building
├─ Syntax validation
└─ On Error → Row-level error, continue with next row

Phase 3: EXECUTION (Batch Processing)
├─ Per Batch:
│  ├─ Create Savepoint
│  ├─ Execute statements
│  ├─ Collect results
│  └─ On Error:
│     ├─ Log error with context
│     ├─ Rollback to Savepoint (batch isolated)
│     ├─ Mark batch as failed
│     └─ Continue with next batch
│
└─ Post-Execution:
   ├─ Compile all errors
   ├─ Generate report
   ├─ Offer rollback option
   └─ Export failed rows

Error Recovery Strategy by Severity:
├─ CRITICAL (Connection, Syntax)
│  └─ Action: Rollback entire transaction, stop
├─ HIGH (Data constraint)
│  └─ Action: Rollback batch savepoint, continue
├─ MEDIUM (Type coercion warning)
│  └─ Action: Log, skip row, continue
└─ LOW (Info/Stats)
    └─ Action: Log only, continue
```

---

## Scalability Design

### Performance Targets

```
Data Size          Processing Time    Memory Usage
──────────────────────────────────────────────────
1K rows            < 1 second          < 50 MB
10K rows           < 5 seconds         < 200 MB
100K rows          < 30 seconds        < 1 GB
1M rows            < 5 minutes         < 2 GB (with batching)
10M+ rows          Via CLI, incremental (no browser)
```

### Scalability Architecture

```
1. MEMORY OPTIMIZATION
   ├─ Streaming Excel parsing (for large files)
   ├─ Virtual scrolling in UI (DataPreview)
   ├─ Pagination for API responses
   ├─ Batch processing (configurable size)
   └─ LRU cache for lookups (10K entries default)

2. DATABASE OPTIMIZATION
   ├─ Connection pooling (10-20 connections)
   ├─ Prepared statements (prevent re-parsing)
   ├─ Batch inserts (multi-value inserts)
   ├─ Index awareness (don't disable during insert)
   ├─ Partitioning awareness (for large tables)
   └─ Query timeout management

3. EXECUTION OPTIMIZATION
   ├─ Parallel batch processing (up to 4 concurrent)
   ├─ Async/await for I/O operations
   ├─ Cancellation support (abort execution)
   ├─ Progress streaming (real-time UI updates)
   └─ Incremental failure recovery

4. CACHING STRATEGY
   ├─ FK Lookup Cache (LRU, 10K entries)
   ├─ Schema Cache (per connection)
   ├─ Mapping Templates (local storage)
   ├─ Validation Results (session-based)
   └─ Connection Pool Caching

5. MONITORING & TUNING
   ├─ Memory profiling
   ├─ Query performance tracking
   ├─ Execution time breakdown
   ├─ Error rate monitoring
   └─ Throughput metrics (rows/sec)
```

### Batch Processing Architecture

```
Input Data (N rows)
       │
       ▼
┌──────────────────┐
│ BatchProcessor   │
│ (size: 1000)     │
└────────┬─────────┘
         │
         ├─► Batch 1 (rows 1-1000)
         ├─► Batch 2 (rows 1001-2000)
         ├─► Batch 3 (rows 2001-3000)
         └─► Batch N

         │
         ├─ Parallel execution
         │  (up to 4 concurrent)
         │
         ├─ Each batch:
         │  ├─ Savepoint created
         │  ├─ Execute SQL
         │  ├─ Collect results
         │  └─ Rollback on error
         │
         ▼
   ┌──────────────┐
   │ Results Merge│
   └────────┬─────┘
            │
            ├─ Success: X rows
            ├─ Failed: Y rows
            ├─ Errors: [...]
            └─ Duration: Z ms
```

### CLI & API Scalability

```
CLI Mode (for large files):
├─ Stream input (don't load entire file)
├─ Stream output (line-by-line writes)
├─ Configurable batch size (default: 1000)
├─ Configurable parallelism (default: 4)
├─ Memory-efficient logging
└─ Interrupt signal handling (graceful shutdown)

API Mode (for concurrent requests):
├─ Connection pooling per server instance
├─ Request queuing (prevent overload)
├─ Timeout management (cancel long-running)
├─ WebSocket streaming for real-time updates
├─ Rate limiting (configurable per user)
└─ Resource cleanup (close connections, free memory)
```

---

## Security Architecture

### SQL Injection Prevention

```
Layer 1: Input Validation
├─ Column name validation (alphanumeric + underscore)
├─ Table name validation (alphanumeric + underscore)
├─ Type checking before formatting
└─ Whitelist for SQL keywords

Layer 2: Parameterized Operations
├─ Use parameterized queries (when executing)
├─ Value escaping (type-specific)
├─ Special character handling
└─ Prepared statements

Layer 3: Code Generation Safety
├─ No string concatenation for SQL
├─ Use builder pattern with validation
├─ Template literals with sanitization
└─ No user input in SQL keywords
```

### Credentials Management

```
Frontend:
├─ NO credentials stored in local storage
├─ NO credentials in API requests
├─ NO credentials in logs/reports
└─ Connection via secure channels only

Backend (Future):
├─ Credentials encrypted at rest
├─ Environment variables for config
├─ Secrets manager integration (AWS Secrets, etc.)
├─ Credentials never logged
├─ Credentials timeout/rotation
└─ Audit trail for credential access
```

### Data Protection

```
Transit:
├─ HTTPS only
├─ TLS 1.2+
├─ Certificate validation
└─ No mixed content

At Rest:
├─ Sensitive data encryption (when persisted)
├─ Audit logs encrypted
├─ Temporary files cleanup
└─ Secure deletion policies

File Exports:
├─ Respect data classification
├─ Optional field masking
├─ Encryption option for exports
└─ Audit trail for downloads
```

---

## Production-Grade Workflow

### Pre-Deployment Checklist

```
CODE QUALITY
├─ [ ] ESLint passing (0 errors)
├─ [ ] TypeScript strict mode (no any)
├─ [ ] Unit test coverage (>80%)
├─ [ ] Integration test coverage (>60%)
├─ [ ] No console.log statements
├─ [ ] Error handling on all paths
├─ [ ] No hardcoded credentials
└─ [ ] Code review approved

SECURITY
├─ [ ] SQL injection tests
├─ [ ] XSS prevention verified
├─ [ ] CSRF tokens in place
├─ [ ] Authentication required
├─ [ ] Authorization checked
├─ [ ] Secrets not in repo
├─ [ ] Dependency audit passed
└─ [ ] OWASP Top 10 reviewed

PERFORMANCE
├─ [ ] Load test: 1K rows < 1s
├─ [ ] Load test: 100K rows < 30s
├─ [ ] Memory profiling done
├─ [ ] Database query optimization
├─ [ ] API response time < 200ms
├─ [ ] UI responsiveness maintained
├─ [ ] Bundle size analyzed
└─ [ ] Cache strategy implemented

RELIABILITY
├─ [ ] Error handling comprehensive
├─ [ ] Graceful degradation on error
├─ [ ] Timeout handling in place
├─ [ ] Connection retry logic
├─ [ ] Transaction rollback tested
├─ [ ] Data consistency verified
├─ [ ] Logging comprehensive
└─ [ ] Monitoring alerts configured

DOCUMENTATION
├─ [ ] API documentation complete
├─ [ ] CLI documentation complete
├─ [ ] User guide written
├─ [ ] Architecture documented
├─ [ ] Deployment guide written
├─ [ ] Troubleshooting guide
├─ [ ] Change log maintained
└─ [ ] Comments on complex logic

DEPLOYMENT
├─ [ ] Database migrations ready
├─ [ ] Backup strategy in place
├─ [ ] Rollback plan documented
├─ [ ] Health checks defined
├─ [ ] Monitoring set up
├─ [ ] Alerting configured
├─ [ ] Staging environment tested
└─ [ ] Production readiness verified
```

### Deployment Strategy

```
1. STAGING DEPLOYMENT
   ├─ Deploy to staging environment
   ├─ Run smoke tests
   ├─ Performance verification
   ├─ Security scan
   ├─ User acceptance testing (UAT)
   └─ Approval before production

2. PRODUCTION DEPLOYMENT
   ├─ Blue-green deployment (if available)
   │  ├─ Deploy to new environment (green)
   │  ├─ Verify health checks
   │  ├─ Run smoke tests
   │  ├─ Route traffic to green
   │  └─ Keep blue for quick rollback
   │
   ├─ OR Canary deployment
   │  ├─ Deploy to 10% of traffic
   │  ├─ Monitor metrics (errors, latency)
   │  ├─ Gradually increase to 100%
   │  └─ Automatic rollback on errors
   │
   └─ OR Rolling deployment
      ├─ Deploy to 1 instance at a time
      ├─ Health checks on each
      ├─ Load balancer removes/adds
      └─ Complete when all updated

3. POST-DEPLOYMENT
   ├─ Smoke test verification
   ├─ Metrics baseline established
   ├─ Alerts triggered if anomalies
   ├─ User notification if needed
   └─ Monitor for 24 hours
```

### Monitoring & Alerting

```
METRICS TO MONITOR
├─ System Health
│  ├─ CPU usage (alert > 80%)
│  ├─ Memory usage (alert > 85%)
│  ├─ Disk space (alert > 90%)
│  └─ Process uptime
│
├─ Application
│  ├─ Error rate (alert > 1%)
│  ├─ Response time p95 (alert > 500ms)
│  ├─ Failed conversion count
│  ├─ Active users
│  └─ Feature usage stats
│
├─ Database
│  ├─ Connection pool usage
│  ├─ Query execution time
│  ├─ Slow queries log
│  └─ Replication lag (if applicable)
│
└─ Business
   ├─ Conversion success rate
   ├─ Rows processed count
   ├─ Average processing time
   └─ User satisfaction (if feedback)

LOGGING STRATEGY
├─ Application Logs (structured JSON)
│  ├─ Request/response logs
│  ├─ Error stacktraces
│  ├─ Conversion events
│  └─ Performance timings
│
├─ Audit Logs
│  ├─ User actions
│  ├─ Conversion execution
│  ├─ Config changes
│  └─ Error corrections
│
└─ Debug Logs (on demand)
   ├─ SQL generation
   ├─ Value formatting
   └─ Type detection details
```

---

## Implementation Roadmap (Detailed)

### Week 1-2: Foundation
- [ ] Set up project structure
- [ ] Create type definitions
- [ ] Implement ExcelParser (basic)
- [ ] Implement SchemaDetector (basic)
- [ ] Create FileUpload UI component
- [ ] Create DataPreview UI component
- [ ] Begin base adapter

### Week 3-4: Core Engine
- [ ] Complete ValidationEngine
- [ ] Implement SQLGenerator (INSERT only)
- [ ] Complete PostgreSQLAdapter
- [ ] Create ColumnMappingPanel
- [ ] Create SqlConfigPanel
- [ ] Create SqlPreview
- [ ] Unit tests (parsing, type detection)

### Week 5-6: Multi-Database
- [ ] Implement MySQLAdapter
- [ ] Implement SQLServerAdapter
- [ ] Test database switching
- [ ] Connection pooling
- [ ] Error handling enhancement
- [ ] Integration tests

### Week 7-8: Advanced Features
- [ ] Multi-sheet support
- [ ] Auto-mapping
- [ ] Conflict resolution (UPSERT/UPDATE)
- [ ] Batch processing
- [ ] Transaction management
- [ ] Savepoint support

### Week 9-10: Execution & Reporting
- [ ] ExecutionManager
- [ ] BatchProcessor
- [ ] ErrorReporter
- [ ] DryRun mode
- [ ] File export
- [ ] Real-time progress streaming

### Week 11-12: Enterprise & Testing
- [ ] API endpoints (REST)
- [ ] CLI tool
- [ ] Profile management
- [ ] Complete test suite
- [ ] Documentation
- [ ] Performance optimization

---

## Conclusion

This architecture provides a **production-ready, scalable, and maintainable** system for converting Excel data to SQL across multiple databases. Key strengths:

✅ **Separation of Concerns**: Clear module boundaries  
✅ **Database Agnostic**: Easy to add new databases  
✅ **Fail-Fast**: Validation before execution  
✅ **Safe Execution**: Transaction support with rollback  
✅ **Error Rich**: Detailed error classification and suggestions  
✅ **Extensible**: Plugin points for custom logic  
✅ **Scalable**: Batch processing with parallelization  
✅ **Secure**: SQL injection prevention, credential management  

The phased rollout ensures MVP delivery while maintaining path to enterprise features.
