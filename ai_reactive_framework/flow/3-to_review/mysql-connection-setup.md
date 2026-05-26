---
feature: mysql-connection-setup
phase: to_review
review_requested: 2026-04-28
wip_started: 2026-04-27
priority: P0
created: 2026-04-27
source: ai_reactive_framework/context/4-plan.md
---

# Business Specification — mysql-connection-setup

---

## 1. Objective

This feature replaces the MongoDB/Mongoose bootstrap in `index.js` with a Sequelize + MySQL connection layer, establishing the database foundation required by all subsequent model migrations. It exists because the project is migrating from MongoDB to MySQL and every domain model (`User`, `Follow`, `Publication`, `Message`) depends on a working Sequelize instance being available at startup. The developer benefits by having a clean, environment-variable-driven database configuration that is safe to commit, easy to configure per environment, and immediately testable via `sequelize.authenticate()` before the server begins accepting requests.

---

## 2. Scope

| In scope | Out of scope |
|----------|-------------|
| Create `config/database.js` exporting a configured Sequelize instance (dialect: mysql, env-based credentials) | Defining or migrating any Mongoose/Sequelize model |
| Update `index.js` to replace `mongoose.connect()` with `sequelize.authenticate()` + `sequelize.sync()` | Seeding or migrating existing MongoDB data |
| Add `sequelize`, `mysql2`, `dotenv` to `package.json` dependencies | Setting up Sequelize migrations (`sequelize-cli`) |
| Remove `mongoose` and `mongoose-pagination` from `package.json` | Modifying any route, controller, or middleware |
| Add `dotenv` bootstrap (`require('dotenv').config()`) as first line of `index.js` | Creating `.env` entries for JWT or bcrypt — those belong to fix-jwt-secret (#8) and add-dotenv (#9) |
| Ensure `.env` is listed in `.gitignore` | Horizontal scaling or connection pooling configuration beyond Sequelize defaults |

---

## 3. Actors

| Actor | Description |
|-------|-------------|
| Developer | Runs `npm install`, configures `.env`, starts the server and verifies DB connectivity |
| Node.js process (bootstrap) | Executes `index.js` at startup — authenticates the Sequelize connection, then starts Express |
| MySQL server | Receives the connection from Sequelize; must be reachable at the configured host/port/database |

---

## 4. User Stories

### Story 1 — Developer connects to MySQL for the first time

**Given** the developer has a running MySQL instance and has created a database (e.g. `social`),
**When** they set `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, and `MYSQL_PORT` in `.env` and run `npm start`,
**Then** the server logs `DB: MySQL connected OK!` and begins listening on the configured port, with no Mongoose errors.

### Story 2 — Connection failure is caught at startup

**Given** the MySQL server is unreachable (wrong host, wrong credentials, or server down),
**When** the process starts and `sequelize.authenticate()` rejects,
**Then** the error is logged to the console and the process exits with a non-zero code — the Express server does NOT start.

### Story 3 — Developer works without code changes per environment

**Given** the developer switches between local, staging, and production environments,
**When** they change only the `.env` file (or environment variables in the deployment platform),
**Then** `config/database.js` picks up the correct credentials without any code modification.

---

## 5. Acceptance Criteria

- [x] `config/database.js` exports a single Sequelize instance configured from `process.env` variables (`MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_PORT`); no credentials are hardcoded.
- [x] `index.js` calls `require('dotenv').config()` as its first statement, then calls `sequelize.authenticate()` before starting the Express server; `mongoose.connect()` is removed entirely.
- [x] `package.json` lists `sequelize@^6`, `mysql2@^3`, and `dotenv@^16` under `dependencies`, and no longer lists `mongoose` or `mongoose-pagination`.
- [x] `.gitignore` contains an entry for `.env` so credentials are never committed.
- [x] Starting the server with valid MySQL credentials logs `DB: MySQL connected OK!` and accepts HTTP requests.
- [x] Starting the server with invalid MySQL credentials logs the connection error and exits without starting the HTTP server.

---

## 6. API Contract

### Entry point

```
node index.js  (or: npm start)
```

This is a bootstrap feature, not an HTTP endpoint. The "contract" is the startup sequence and the exported Sequelize instance.

### `config/database.js` — exported interface

```js
// Usage in other modules:
const sequelize = require('./config/database');
await sequelize.authenticate();   // verifies connection
await sequelize.sync();           // creates/updates tables
```

### Environment variables (inputs)

| Variable | Type | Required | Default | Validation |
|----------|------|----------|---------|------------|
| `MYSQL_HOST` | string | Yes | — | Valid hostname or IP |
| `MYSQL_USER` | string | Yes | — | Non-empty string |
| `MYSQL_PASSWORD` | string | Yes | — | Non-empty string |
| `MYSQL_DATABASE` | string | Yes | — | Non-empty string |
| `MYSQL_PORT` | number | No | `3306` | Integer 1–65535 |
| `PORT` | number | No | `3000` | Integer — Express listen port |

### Startup success output

```
Starting...
DB: MySQL connected OK!
Server running on => 3000
```

### Startup failure output

```
Starting...
Error: Unable to connect to the database: Access denied for user '...'@'...'
[process exits with code 1]
```

---

## 7. Business Rules

| # | Rule | Rationale |
|---|------|-----------|
| BR-01 | `config/database.js` must be stateless — it only configures and exports the Sequelize instance; it does not import models or start the server | Prevents circular dependencies when models `require` the database config |
| BR-02 | All database credentials must be read exclusively from `process.env` — no fallback values for host, user, password, or database name | Prevents accidental connection to production from a misconfigured local environment |
| BR-03 | `sequelize.authenticate()` must succeed before `app.listen()` is called — startup must abort on connection failure | Prevents the server from starting in a broken state where all DB-dependent endpoints would fail |
| BR-04 | `.env` must never be committed — `.gitignore` must list `.env` before this feature is merged | Protects database credentials from source control exposure |
| BR-05 | `mongoose` and `mongoose-pagination` must be removed from `package.json` as part of this feature | Keeps the dependency tree clean; these packages serve no purpose once the Sequelize layer is in place |

---

## 8. State Transitions

Not applicable — this feature is a one-time bootstrap setup, not a stateful entity lifecycle.

---

## 9. Error Cases

| Scenario | Error Type | HTTP Status | Message |
|----------|-----------|-------------|---------|
| `MYSQL_HOST` / `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DATABASE` not set in environment | startup_error | — (process exits) | `Missing required env var: MYSQL_DATABASE` |
| MySQL server unreachable (wrong host or port) | connection_error | — (process exits) | Sequelize: `ECONNREFUSED` — logged and process exits |
| Wrong MySQL credentials | auth_error | — (process exits) | Sequelize: `Access denied for user` — logged and process exits |
| `mysql2` package not installed (missing from node_modules) | dependency_error | — (process crashes) | `Cannot find module 'mysql2'` — run `npm install` |
| Sequelize `sync()` fails (schema conflict) | sync_error | — (process exits) | Sequelize sync error — logged and process exits |

---

## 10. Non-Functional Requirements

| Attribute | Target |
|-----------|--------|
| Latency (p99) | < 2000 ms for initial `authenticate()` on LAN; < 5000 ms for remote/cloud MySQL |
| Availability | 99.9% — dependent on MySQL server uptime |
| Throughput | Sequelize default connection pool: 5 connections (min 0, max 5) — sufficient for single-instance development |
| Data sensitivity | Non-PII — this feature handles only connection configuration, not user data |
| Environment parity | Credentials must be identical in shape across local, staging, and production — only values differ via `.env` |

---

## 11. Dependencies

| System / File | Type | Purpose |
|--------------|------|---------|
| `sequelize@^6` | npm package | ORM that manages the MySQL connection pool and model API |
| `mysql2@^3` | npm package | MySQL protocol driver required by Sequelize |
| `dotenv@^16` | npm package | Loads `.env` file into `process.env` at startup |
| `ai_reactive_framework/context/0-context.md` | embedded knowledge base | Tech stack, architecture, and environment variable conventions |
| `ai_reactive_framework/context/4-plan.md` | embedded knowledge base | Feature definition: files to create/update, dependencies, risks |
| `ai_reactive_framework/1-business_layer/templates/business_rules_template.md` | embedded knowledge base | Specification structure and section conventions |
| `.env` (runtime) | local config file | Supplies `MYSQL_*` and `PORT` values at runtime — must exist before `npm start` |

---

## 12. Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| OQ-01 | Should `sequelize.sync({ force: false })` be used at startup (auto-creates missing tables) or should schema management be delegated to `sequelize-cli` migrations from the start? | Developer | — |
| OQ-02 | Is there a specific MySQL version requirement (e.g. 8.0+) or character set/collation (`utf8mb4`) that must be enforced in the Sequelize dialect options? | Developer | — |
