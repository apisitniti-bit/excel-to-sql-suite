# Excel-to-SQL Suite Roadmap

PostgreSQL-focused Excel conversion tool. Production-ready by v1.0.

## v0.1 — Core Functionality ✅

**Status**: Complete

- [x] Excel parsing via `xlsx` library
- [x] Basic PostgreSQL type detection (UUID, INTEGER, BIGINT, DECIMAL, BOOLEAN, DATE, TIMESTAMPTZ, JSONB, TEXT)
- [x] INSERT / UPDATE / UPSERT generation
- [x] Browser-based processing (zero backend)
- [x] Transaction wrapper support
- [x] Batch processing for large datasets

**Target**: Functional converter for files up to 10,000 rows

---

## v0.2 — Data Quality (In Progress)

**Target**: Week 1-2

- [ ] Validation error reporting with exact row/column references
- [ ] Preview first 10 rows with type guesses before conversion
- [ ] Distinguish NULL vs empty string handling
- [ ] Auto-detect probable primary keys (unique + not null columns)
- [ ] Data quality score (completeness % per column)

**Definition of Done**: User can identify data issues before running SQL

---

## v0.3 — Robustness

**Target**: Week 3-4

- [ ] Streaming parser for files > 50MB (don't load entire file to memory)
- [ ] Progress indicators for 10k+ row files
- [ ] Handle special characters in strings (null bytes, control chars)
- [ ] Test suite with 20+ real-world Excel files
- [ ] Graceful degradation for corrupted/malformed cells

**Definition of Done**: Handles 100k row files without freezing

---

## v0.4 — Usability

**Target**: Week 5-6

- [ ] Column name sanitization (spaces → underscores, special chars)
- [ ] Remember last used mappings per file signature (SHA256)
- [ ] Export/import mapping configurations (JSON)
- [ ] Keyboard shortcuts for common actions
- [ ] Copy SQL to clipboard with one click

**Definition of Done**: Repeat users save 50%+ time on similar files

---

## v0.5 — Power User Features

**Target**: Week 7-8

- [ ] CLI version for CI/CD pipelines (`npx excel-to-sql-suite`)
- [ ] Transform functions: uppercase, lowercase, trim, regex replace
- [ ] Foreign key detection suggestions (column name matching)
- [ ] Index recommendations (frequently filtered columns)
- [ ] Multi-sheet batch conversion

**Definition of Done**: Useful for automated data pipelines

---

## v1.0 — Production Ready

**Target**: Week 9-10

- [ ] Comprehensive documentation (API reference + examples)
- [ ] 95%+ test coverage (unit + integration)
- [ ] Performance benchmark: 50k rows < 3 seconds
- [ ] npm package publication (`excel-to-sql-suite`)
- [ ] GitHub Actions for automated releases
- [ ] Security audit (XSS prevention, file validation)
- [ ] Browser compatibility: Chrome, Firefox, Safari, Edge (latest 2 versions)

**Definition of Done**: Enterprise teams can adopt with confidence

---

## Post-v1.0 Ideas (Not Committed)

- **Multi-dialect support**: MySQL, SQLite, BigQuery (only if requested)
- **Direct database connection**: Test SQL against real PostgreSQL instance
- **Schema diff**: Compare Excel against existing table structure
- **Column mapping AI**: Suggest mappings based on column name similarity

---

## Principles

1. **PostgreSQL-only until v1.0** — Do one thing exceptionally well
2. **Privacy first** — No file data leaves the browser
3. **Progress over perfection** — Ship working features, refine later
4. **Real-world tested** — Every feature validated against actual data files

---

## Changelog Format

Each release follows [Keep a Changelog](https://keepachangelog.com/):

```markdown
## [0.2.0] - 2024-02-15

### Added
- Validation error reporting with row numbers

### Fixed
- BIGINT detection for values > 2^31

### Changed
- Type detection now samples 1000 rows instead of 100
```
