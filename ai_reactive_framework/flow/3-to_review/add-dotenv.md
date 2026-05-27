---
feature: add-dotenv
phase: to_review
review_requested: 2026-05-26
priority: P0
created: 2026-05-26
source: ai_reactive_framework/context/4-plan.md
---

# Business Specification — add-dotenv

---

## 1. Objective

This feature adds `dotenv` to the project so that environment variables can be loaded from a `.env` file at application bootstrap, replacing the previous pattern of bare `process.env` reads with no local configuration file. It exists because the application requires runtime configuration for MySQL credentials, JWT secret, and port — none of which should be hardcoded in source files. Without dotenv, developers must manually export each variable in their shell before starting the server. The developer benefits by being able to run the application locally with a single `npm start` after copying `.env.example` to `.env` and filling in their values, with no shell setup required.

---

## 2. Scope

| In scope | Out of scope |
|----------|-------------|
| Add `require('dotenv').config()` as the first line of `index.js` | Managing secrets in production environments (use platform secrets manager) |
| Add `dotenv@^16` to `package.json` dependencies | Encrypting or rotating secrets |
| Ensure `.env` is listed in `.gitignore` | Adding a secrets vault or dynamic secret injection |
| Create `.env` with all required variables (PORT, MYSQL_*, JWT_SECRET) | Adding per-environment `.env.production` / `.env.test` overrides |
| Create `.env.example` documenting all required variables | Validating env var formats beyond presence checks |

---

## 3. Actors

| Actor | Description |
|-------|-------------|
| Developer | Creates `.env` from `.env.example`, runs `npm install`, starts the server |
| Node.js process | Reads `.env` via dotenv at bootstrap; all subsequent `process.env` reads are satisfied |
| Express HTTP server | Consumes `PORT`, `MYSQL_*`, and `JWT_SECRET` from `process.env` — no hardcoded values |
| CI/CD pipeline | Injects variables via platform env vars (dotenv is a no-op when `.env` is absent and env vars are already set) |

---

## 4. User Stories

### Story 1 — Developer starts the server locally with no shell exports

**Given** a developer has cloned the repo, run `npm install`, and copied `.env.example` to `.env` with their local values,
**When** they run `npm start`,
**Then** `require('dotenv').config()` loads all variables before any module reads `process.env`, and the server starts without "Missing required env var" errors.

### Story 2 — Missing variable caught at startup

**Given** a developer has a `.env` file but forgot to set `MYSQL_HOST`,
**When** the server starts,
**Then** `index.js` required-env validation fires and exits with `"Missing required env var: MYSQL_HOST"` — preventing a silent runtime failure deep inside a database call.

### Story 3 — CI/CD deployment works without a .env file

**Given** a CI/CD pipeline injects `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, and `JWT_SECRET` as platform environment variables (no `.env` file present),
**When** `require('dotenv').config()` runs,
**Then** dotenv silently finds no `.env` file and the already-set platform variables remain in `process.env` — the server starts normally.

---

## 5. Acceptance Criteria

- [ ] `package.json` contains `"dotenv": "^16.0.0"` (or higher) in `dependencies`.
- [ ] `index.js` has `require('dotenv').config()` as the very first executable statement — before any other `require()` or `process.env` read.
- [ ] `.gitignore` contains `.env` so the local secrets file is never committed.
- [ ] `.env` exists locally with entries for `PORT`, `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_PORT`, and `JWT_SECRET`.
- [ ] `.env.example` documents all required variables with placeholder values so new developers know what to configure.
- [ ] `index.js` validates that all required env vars (`MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, `JWT_SECRET`) are present and exits with a clear error message if any are missing.

---

## 6. API Contract

### Affected files

| File | Change |
|------|--------|
| `index.js` | `require('dotenv').config()` added as first line; required-env validation added |
| `package.json` | `"dotenv": "^16.0.0"` added to `dependencies` |
| `.gitignore` | `.env` entry added |
| `.env` | Created with all required variables |
| `.env.example` | Created documenting all required variables |

### Required environment variables

| Variable | Example Value | Purpose |
|----------|--------------|---------|
| `PORT` | `3000` | HTTP listen port (optional — defaults to 3000) |
| `MYSQL_HOST` | `localhost` | MySQL server hostname |
| `MYSQL_USER` | `root` | MySQL username |
| `MYSQL_PASSWORD` | `root` | MySQL password |
| `MYSQL_DATABASE` | `social` | MySQL database name |
| `MYSQL_PORT` | `3306` | MySQL port (optional — defaults to 3306) |
| `JWT_SECRET` | `<random>` | JWT signing secret |

---

## 7. Business Rules

| # | Rule | Rationale |
|---|------|-----------|
| BR-01 | `require('dotenv').config()` must be the first line of `index.js` — before all other `require()` calls | Any module that reads `process.env` at load time (e.g. `config/database.js`) must see the populated env vars; calling dotenv after other requires creates a race |
| BR-02 | `.env` must not be committed to git — `.gitignore` must include `.env` | Committing secrets to source control defeats the purpose of externalising configuration |
| BR-03 | `.env.example` must be committed and kept up to date with every new variable added | Without a documented template, new team members or CI pipelines cannot reproduce the required configuration |
| BR-04 | Required variable validation in `index.js` must list every variable the application cannot start without — missing any should cause a non-zero exit | Silent `undefined` values propagate into database connections and crypto operations, causing confusing runtime errors far from the source |

---

## 8. State Transitions

Not applicable — this feature adds bootstrap configuration loading; it does not introduce new entity lifecycle states.

---

## 9. Error Cases

| Scenario | Error Type | HTTP Status | Message |
|----------|-----------|-------------|---------|
| Required env var missing at startup | `startup_error` | — (process.exit(1)) | `"Missing required env var: <KEY>"` |
| `.env` file absent (CI/CD mode) | — (silent) | — | dotenv silently skips; platform-injected vars are used |
| `dotenv` not installed | `dependency_error` | — (crash) | `"Cannot find module 'dotenv'"` — run `npm install` |

---

## 10. Non-Functional Requirements

| Attribute | Target |
|-----------|--------|
| Latency (p99) | No measurable change — dotenv file parse is synchronous and runs once at startup |
| Availability | 99.9% — dependent on correct `.env` configuration at deployment |
| Compatibility | dotenv@^16 requires Node.js 12+; fully compatible with Node.js 18.x |
| Data sensitivity | `.env` contains credentials — never committed, never logged, never returned in API responses |

---

## 11. Dependencies

| System / File | Type | Purpose |
|--------------|------|---------|
| `dotenv@^16` | npm package | Parses `.env` file and merges variables into `process.env` at startup |
| `index.js` | internal module | Bootstrap entry point — must call `require('dotenv').config()` first |
| `package.json` | project manifest | Dependency list — `dotenv` added |
| `.gitignore` | project config | Ensures `.env` is not tracked by git |
| `ai_reactive_framework/context/0-context.md` | embedded knowledge base | Tech stack, environment variable conventions, bootstrap pattern |
| `ai_reactive_framework/context/4-plan.md` | embedded knowledge base | Feature definition, required env var list |

---

## 12. Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| OQ-01 | Should `dotenv-expand` be added to support variable interpolation (e.g. `DATABASE_URL=${MYSQL_USER}:${MYSQL_PASSWORD}@${MYSQL_HOST}`)? | Developer | — |
| OQ-02 | Should `MYSQL_PORT` and `PORT` be added to the required-env validation list, or left as optional with defaults (`3306` and `3000` respectively)? | Developer | — |
