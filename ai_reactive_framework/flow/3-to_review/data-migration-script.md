---
feature: data-migration-script
phase: to_review
review_requested: 2026-05-26
priority: P2
created: 2026-05-26
source: ai_reactive_framework/context/4-plan.md
---

# Business Specification — data-migration-script

---

## 1. Objective

This feature delivers a one-time standalone Node.js script (`scripts/migrate-mongo-to-mysql.js`) that reads all documents from a live MongoDB database (via Mongoose) and inserts them into the corresponding MySQL tables (via Sequelize). It exists because the application's Sequelize models and MySQL schema are now fully defined, but production data still lives in MongoDB from the original deployment. Without this script, any production cutover would lose all existing users, follows, publications, and messages. The developer benefits by being able to run a single `node scripts/migrate-mongo-to-mysql.js` command that handles all four collections in the correct FK constraint order, coerces legacy field types, and logs a per-collection summary of migrated and failed records.

---

## 2. Scope

| In scope | Out of scope |
|----------|-------------|
| Connect to both MongoDB (Mongoose) and MySQL (Sequelize) within the same script process | Ongoing data sync or change-data-capture after cutover |
| Migrate `users` collection → `users` table (first, no FK deps) | Rolling migration with zero downtime |
| Migrate `follows` collection → `follows` table (after users) | Reverting the migration or undo tooling |
| Migrate `publications` collection → `publications` table (after users) | Migrating uploaded image files (binary blobs / object store) |
| Migrate `messages` collection → `messages` table (after users) | Adding new fields not present in the original Mongoose schemas |
| Map MongoDB `_id` (ObjectId) to a stored `old_id` field for cross-reference during migration | Continuous integration or automated re-run in CI pipelines |
| Coerce `viewed` field from String (`"true"`/`"false"`) to Boolean | Validating data integrity after migration (separate concern) |
| Parse `created_at` String fields to DATETIME using `Date` or `moment` | Modifying the Express app or any existing controller |
| Log per-collection counts: attempted, inserted, skipped/failed | |
| Exit with code `0` on full success, `1` on any collection failure | |

---

## 3. Actors

| Actor | Description |
|-------|-------------|
| Developer | Runs `node scripts/migrate-mongo-to-mysql.js` once after verifying both databases are reachable; reviews the per-collection log to confirm row counts |
| MongoDB instance | Source database — exposes all four collections via Mongoose for read access |
| MySQL instance | Target database — receives all migrated rows via Sequelize bulk insert |
| Node.js process | Executes the script; connects to both DBs, reads all docs, inserts all rows, logs results, then exits |

---

## 4. User Stories

### Story 1 — Full migration completes in FK order

**Given** both MongoDB (with existing `users`, `follows`, `publications`, `messages` collections) and MySQL (with empty tables from `sequelize.sync()`) are reachable,
**When** the developer runs `node scripts/migrate-mongo-to-mysql.js`,
**Then** the script migrates collections in order (`users` → `follows` → `publications` → `messages`), all rows are present in MySQL, and the console shows counts matching MongoDB document counts.

### Story 2 — Legacy field types are coerced correctly

**Given** the MongoDB `messages` collection contains documents with `viewed: "true"` or `viewed: "false"` (String), and `messages` / `publications` contain `created_at` as a String,
**When** the script processes each message document,
**Then** `viewed` is stored as `true`/`false` (Boolean) in MySQL, and `created_at` is stored as a valid DATETIME — not as a string literal.

### Story 3 — Partial failure does not silently skip records

**Given** one document in the `follows` collection references a `userId` that did not exist in MongoDB (orphaned reference) and therefore has no corresponding MySQL user row,
**When** the script attempts to insert that follow row,
**Then** the insert fails with a FK constraint error, the failure is logged with the `_id` of the offending document, the error count for that collection is incremented, and the script continues to the next document rather than aborting the entire migration.

---

## 5. Acceptance Criteria

- [ ] `scripts/migrate-mongo-to-mysql.js` exists and is executable with `node scripts/migrate-mongo-to-mysql.js`.
- [ ] The script migrates collections in the order `users → follows → publications → messages`; it must not attempt `follows` before `users` is complete (FK constraint order).
- [ ] Each MongoDB `_id` (ObjectId) is stored in an `old_id` VARCHAR column (or logged alongside the new INT id) so records can be cross-referenced between old and new databases during the cutover period.
- [ ] `viewed` String values (`"true"`, `"false"`) are coerced to Boolean (`true`, `false`) before MySQL insert; any other string value is treated as `false` and logged as a warning.
- [ ] `created_at` String fields are parsed to JavaScript `Date` objects before insert; unparseable values are replaced with `new Date()` and logged as a warning.
- [ ] The script prints a per-collection summary line: `[users] attempted: N, inserted: N, failed: N` (and equivalent for each collection); it exits with code `0` if all four collections report zero failures, or code `1` if any collection has failures.

---

## 6. API Contract

### Invocation

```bash
node scripts/migrate-mongo-to-mysql.js
```

No command-line arguments. All configuration is read from `process.env` (loaded via `.env` through `dotenv`).

### Environment variables required

| Variable | Purpose |
|----------|---------|
| `MONGODB_URL` | MongoDB connection string (source) |
| `MYSQL_HOST` | MySQL host (target) |
| `MYSQL_USER` | MySQL user (target) |
| `MYSQL_PASSWORD` | MySQL password (target) |
| `MYSQL_DATABASE` | MySQL database name (target) |
| `MYSQL_PORT` | MySQL port (target, default 3306) |

### Output — success

```
Connecting to MongoDB...
Connecting to MySQL...
[users]        attempted: 42,  inserted: 42,  failed: 0
[follows]      attempted: 118, inserted: 118, failed: 0
[publications] attempted: 73,  inserted: 73,  failed: 0
[messages]     attempted: 201, inserted: 201, failed: 0
Migration complete. Total: 434 records migrated, 0 failed.
```

Exit code: `0`

### Output — partial failure

```
[follows] WARN: FK violation for _id=<objectId> (userId not found) — skipped
[follows]      attempted: 118, inserted: 117, failed: 1
Migration complete with errors. Total: 433 records migrated, 1 failed.
```

Exit code: `1`

### Output — connection failure

```
ERROR: Could not connect to MongoDB — <error message>
```

Exit code: `1`

---

## 7. Business Rules

| # | Rule | Rationale |
|---|------|-----------|
| BR-01 | Collections must be migrated in FK order: `users` first, then `follows`, `publications`, and `messages` in any order after users | `follows`, `publications`, and `messages` all reference `users.id` via FK; inserting them before the corresponding user row exists causes a constraint violation |
| BR-02 | Individual document insert failures must be caught, logged, and skipped — the script must not abort the entire collection on a single row failure | A single bad document (orphaned reference, encoding issue) must not prevent the remaining valid documents from migrating |
| BR-03 | The script must not modify the Express application or any model/controller file — it is a standalone read/write utility | Keeping the migration isolated prevents accidental changes to production app behaviour |
| BR-04 | `viewed: "true"` → `true`, `viewed: "false"` → `false`; any other value → `false` with a warning | The MySQL column is BOOLEAN; inserting a string would either fail silently or corrupt the stored value |
| BR-05 | The script reads from `.env` via `require('dotenv').config()` — no connection strings may be hardcoded | Credentials must never appear in source code; the same `.env` pattern used by the Express app applies here |

---

## 8. State Transitions

Not applicable — this script is a one-time data migration utility; it does not introduce new entity lifecycle states in the application.

---

## 9. Error Cases

| Scenario | Error Type | Exit Code | Message |
|----------|-----------|-----------|---------|
| MongoDB connection fails at startup | `connection_error` | 1 | `"ERROR: Could not connect to MongoDB — <error>"` |
| MySQL connection fails at startup | `connection_error` | 1 | `"ERROR: Could not connect to MySQL — <error>"` |
| Required env var missing (`MONGODB_URL`, `MYSQL_*`) | `startup_error` | 1 | `"Missing required env var: <KEY>"` |
| Individual document insert fails (FK violation, encoding) | `row_error` (non-fatal) | — (continues) | `"WARN: insert failed for _id=<id> (<collection>) — <error message>"` |
| All rows in a collection fail | `collection_error` | 1 (at end) | Reflected in final summary line: `failed: N` |
| `created_at` field cannot be parsed to Date | `type_coercion_warning` (non-fatal) | — | `"WARN: unparseable created_at for _id=<id> — using current timestamp"` |

---

## 10. Non-Functional Requirements

| Attribute | Target |
|-----------|--------|
| Latency | Not a real-time concern — script is one-time; total runtime of < 5 minutes for up to 100k records is acceptable |
| Availability | N/A — one-time script, not a long-running service |
| Idempotency | Not guaranteed — running the script twice will attempt duplicate inserts; the developer must truncate MySQL tables or use `INSERT IGNORE` / `ON DUPLICATE KEY UPDATE` before re-running |
| Data sensitivity | Migrates user credentials (hashed passwords), message text, and follow graph — run only in secure environment; never log actual field values |
| Compatibility | Requires Node.js 18.x, `mongoose@^5`, `sequelize@^6`, `mysql2@^3` — all already present in `package.json` or resolvable from existing deps |

---

## 11. Dependencies

| System / File | Type | Purpose |
|--------------|------|---------|
| `mongoose@^5` | npm package | Connects to MongoDB (source); reads all collection documents |
| `sequelize@^6` | npm package | Connects to MySQL (target); bulk-inserts migrated rows |
| `mysql2@^3` | npm package | MySQL driver required by Sequelize |
| `dotenv@^16` | npm package | Loads `.env` at script start for both DB connection strings |
| `moment@^2` (optional) | npm package | Parse legacy `created_at` String fields to Date; can use `new Date()` as fallback |
| `models/user.js` | internal module | Sequelize User model — used for MySQL insert target |
| `models/follow.js` | internal module | Sequelize Follow model — used for MySQL insert target |
| `models/publication.js` | internal module | Sequelize Publication model — used for MySQL insert target |
| `models/message.js` | internal module | Sequelize Message model — used for MySQL insert target |
| `config/database.js` | internal module | Sequelize instance — provides MySQL connection and `sync()` |
| `ai_reactive_framework/context/0-context.md` | embedded knowledge base | Tech stack, MySQL schema definitions, field types |
| `ai_reactive_framework/context/4-plan.md` | embedded knowledge base | Migration order, field coercion notes, FK constraint order |

---

## 12. Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| OQ-01 | Should the script use `Model.bulkCreate()` for performance, or insert row-by-row to allow per-document error isolation? (bulkCreate is faster but aborts the batch on first failure unless `{ ignoreDuplicates: true }` is set) | Developer | — |
| OQ-02 | Should the `old_id` (original MongoDB ObjectId) be stored as a VARCHAR column in each MySQL table for cross-reference, or only logged to a file during migration and discarded after cutover? | Developer | — |
