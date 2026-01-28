# Phase 2 Quick Start Guide

## Installation & Verification

```bash
# Navigate to project
cd excel-to-sql-suite

# Install dependencies (if not already done)
npm install

# Run Phase 2 tests to verify everything works
npm test -- phase2-modules.test.ts

# Expected output:
# ✅ Test Files  1 passed (1)
# ✅      Tests  12 passed (12)
```

---

## 30-Second Overview

Phase 2 adds three production-grade modules for handling advanced Excel-to-SQL operations:

1. **TransactionManager**: Handle database transactions safely
2. **ConflictResolutionEngine**: Resolve duplicate key conflicts  
3. **ExecutionManager**: Orchestrate SQL execution with multiple modes

---

## Basic Usage Examples

### 1. Simple Transaction (30 seconds)

```typescript
import { TransactionManager } from '@/lib/transaction-manager';

const txMgr = new TransactionManager('postgresql');

// Start transaction
txMgr.beginTransaction();

try {
  // Your database operations here
  
  // Commit changes
  txMgr.commitTransaction();
  console.log('✓ Transaction committed');
} catch (error) {
  // Rollback on error
  txMgr.rollbackTransaction();
  console.error('✗ Transaction rolled back');
}
```

### 2. Validate Before Execution (30 seconds)

```typescript
import { ExecutionManager } from '@/lib/execution-manager';

const execMgr = new ExecutionManager('postgresql');

// Dry run to validate
const validation = await execMgr.executeDryRun(
  excelData,
  mappings,
  sqlConfig
);

if (validation.isValid) {
  console.log(`✓ Valid - ${validation.statementCount} statements`);
  console.log(`Will affect ~${validation.estimatedRowsAffected} rows`);
} else {
  console.error('✗ Validation errors:');
  validation.errors.forEach(e => console.error(`  - ${e}`));
}
```

### 3. Preview What Will Change (30 seconds)

```typescript
const result = await execMgr.executePreviewDiff(
  excelData,
  mappings,
  sqlConfig
);

console.log('Changes to be made:');
result.afterData?.forEach((change, i) => {
  console.log(`Row ${i}: ${change.action}`);
  console.log(`  ${JSON.stringify(change.after)}`);
});
```

### 4. Export SQL to File (30 seconds)

```typescript
const result = await execMgr.executeFileExport(
  excelData,
  mappings,
  sqlConfig
);

// Save generated SQL
const fs = require('fs');
fs.writeFileSync('export.sql', result.sql);
console.log('✓ Exported to export.sql');
console.log(result.report);
```

### 5. Execute Against Database (30 seconds)

```typescript
const result = await execMgr.executeDirectExecution(
  excelData,
  mappings,
  sqlConfig,
  (progress) => {
    console.log(`Processing: ${progress}%`);
  }
);

console.log(result.report);
if (result.status === 'success') {
  console.log(`✓ Successfully inserted ${result.succeededRows} rows`);
} else {
  console.error(`✗ ${result.failedRows} rows failed`);
}
```

---

## Common Patterns

### Pattern 1: Safe Transaction with Savepoints

```typescript
const txMgr = new TransactionManager('postgresql');

try {
  txMgr.beginTransaction();
  
  // Batch 1
  txMgr.createSavepoint('batch1');
  // ... process batch 1 ...
  txMgr.releaseSavepoint('batch1');
  
  // Batch 2
  txMgr.createSavepoint('batch2');
  // ... process batch 2 ...
  txMgr.releaseSavepoint('batch2');
  
  txMgr.commitTransaction();
} catch (error) {
  console.error('Error:', error);
  txMgr.rollbackTransaction();
}
```

### Pattern 2: Three-Stage Execution

```typescript
const execMgr = new ExecutionManager('postgresql');

// Stage 1: Validate
const validation = await execMgr.executeDryRun(data, mappings, config);
if (!validation.isValid) {
  console.error('Validation failed');
  return;
}

// Stage 2: Preview
const preview = await execMgr.executePreviewDiff(data, mappings, config);
console.log(preview.report);

// Stage 3: Execute (if approved)
const result = await execMgr.executeDirectExecution(
  data, mappings, config
);
console.log(result.report);
```

### Pattern 3: Conflict Handling

```typescript
import { ConflictResolutionEngine } from '@/lib/conflict-resolution';

const conflictEngine = new ConflictResolutionEngine('postgresql');

// Analyze conflicts
const analysis = conflictEngine.analyzeConflicts(data, mappings, config);

// Get recommendation
const recommendedMode = analysis.recommendedStrategy;
console.log(`Recommended strategy: ${recommendedMode}`);

// Use in execution
config.options.onConflictAction = 
  recommendedMode === 'UPSERT' ? 'DO UPDATE' : 'DO NOTHING';
```

---

## Testing Your Implementation

```bash
# Run all Phase 2 tests
npm test -- phase2-modules.test.ts

# Run specific test
npm test -- phase2-modules.test.ts -t "TransactionManager"

# Watch mode (auto-rerun on changes)
npm test -- phase2-modules.test.ts --watch

# With coverage
npm test -- phase2-modules.test.ts --coverage
```

---

## Troubleshooting

### Issue: "Cannot find module"
```
✓ Solution: Import from @/lib/execution-manager
✗ Wrong:   import { ... } from '../execution-manager'
✓ Right:   import { ... } from '@/lib/execution-manager'
```

### Issue: Transaction state not updating
```typescript
// ✓ Correct way to check
const state = manager.getState();
if (state.isActive) { /* ... */ }

// ✗ Don't do this
const tx = manager.beginTransaction(); // Returns SQL, not state
```

### Issue: SQL Server savepoint errors
```typescript
// MSSQL uses "SAVE TRANSACTION" not "SAVEPOINT"
// This is handled automatically!
const mssqlMgr = new TransactionManager('mssql');
mssqlMgr.createSavepoint('sp1'); // Generates SAVE TRANSACTION sp1
```

---

## Performance Tips

1. **Batch Operations**: Set `batchSize` to 1000+ for better performance
2. **Concurrency**: Use `maxConcurrency: 4` for parallel processing
3. **Timeout**: Set appropriate timeout for large datasets
4. **DRY_RUN First**: Always validate before actual execution

```typescript
const result = await execMgr.execute(
  'direct-execution',
  data,
  mappings,
  config,
  {
    batchSize: 5000,      // Process 5000 rows per batch
    maxConcurrency: 8,    // Run 8 batches in parallel
    timeout: 60000        // 60 second timeout
  }
);
```

---

## Database Support

All Phase 2 modules support:

| Feature | PostgreSQL | MySQL | MSSQL |
|---------|------------|-------|-------|
| Transactions | ✅ | ✅ | ✅ |
| Savepoints | ✅ | ✅ | ✅ |
| UPSERT | ON CONFLICT | DUPLICATE KEY | MERGE |
| DRY_RUN | ✅ | ✅ | ✅ |
| All Modes | ✅ | ✅ | ✅ |

---

## Next Steps

1. ✅ **Learn**: Read the [Phase 2 API Reference](./PHASE2_API_REFERENCE.md)
2. ✅ **Practice**: Run the example code above
3. ✅ **Integrate**: Use in your application
4. ✅ **Test**: Run `npm test` to verify
5. ✅ **Deploy**: When ready for production

---

## File Locations

- **Transaction Manager**: `src/lib/transaction-manager.ts`
- **Conflict Resolution**: `src/lib/conflict-resolution.ts`
- **Execution Manager**: `src/lib/execution-manager.ts`
- **Tests**: `src/test/phase2-modules.test.ts`
- **Full API Docs**: `PHASE2_API_REFERENCE.md`
- **Status Report**: `PHASE2_STATUS.md`

---

## Support & Documentation

For detailed API documentation, see:
- **API Reference**: [PHASE2_API_REFERENCE.md](./PHASE2_API_REFERENCE.md)
- **Status Report**: [PHASE2_STATUS.md](./PHASE2_STATUS.md)
- **Completion Summary**: [PHASE2_COMPLETION.md](./PHASE2_COMPLETION.md)

For code examples:
- Check `src/test/phase2-modules.test.ts` for working examples
- Each class has comprehensive JSDoc comments

---

## Summary

Phase 2 provides three production-ready modules:

| Module | Purpose | Key Method |
|--------|---------|-----------|
| **TransactionManager** | Safe database transactions | `execute()` / `commit()` / `rollback()` |
| **ConflictResolutionEngine** | Handle duplicate keys | `analyzeConflicts()` / `buildUpsertModeSQL()` |
| **ExecutionManager** | Orchestrate execution | `execute()` with 4 modes |

All modules are:
- ✅ Production-ready
- ✅ Fully tested (12 tests passing)
- ✅ Type-safe (TypeScript strict mode)
- ✅ Well-documented
- ✅ Zero errors

**Ready to use!** 🚀
