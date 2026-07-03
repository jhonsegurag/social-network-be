# Issues & Blockers — social-network-be / JSP

## Open Issues

### I1 — Hardcoded JWT secret
- **Status:** Open
- **Severity:** Critical
- **Affected component:** `services/jwt.js`, `middlewares/authenticated.js`
- **Description:** JWT signing secret `'Secret_Key1-2-3.'` is hardcoded in source code. Anyone with repo access can forge tokens.
- **Root cause:** Secret not extracted to environment variable.
- **Workaround:** None — all tokens are vulnerable until fixed.
- **Resolution:** Move to `process.env.JWT_SECRET`; rotate the secret; invalidate all existing tokens.

### I2 — `pify` not declared in `package.json`
- **Status:** Open
- **Severity:** High
- **Affected component:** `controllers/user.js`, `controllers/publication.js`
- **Description:** `const pify = require('pify')` is used in both upload controllers but `pify` is not listed in `dependencies` or `devDependencies`.
- **Root cause:** Missing package declaration.
- **Workaround:** Works if `pify` is available as a transitive dependency of another package, but is not guaranteed.
- **Resolution:** Run `npm install pify --save`.

### I3 — Deprecated `bcrypt-nodejs` package
- **Status:** Open
- **Severity:** High
- **Affected component:** `controllers/user.js`, `package.json`
- **Description:** `bcrypt-nodejs` (version `0.0.3`) is unmaintained, has known vulnerabilities, and is not compatible with Node.js 18+ in some environments.
- **Root cause:** Package not updated during Node.js 18 migration.
- **Workaround:** May work if native bindings compile, but is not reliable.
- **Resolution:** Replace with `bcryptjs` (pure JS, maintained) or `bcrypt` (native). Update `controllers/user.js` import and usage.

### I4 — No test suite defined
- **Status:** Open
- **Severity:** Medium
- **Affected component:** All (`package.json` `test` script)
- **Description:** `npm test` exits with code 1 (`"Error: no test specified"`). There are no unit, integration, or E2E tests.
- **Root cause:** Tests were never implemented.
- **Workaround:** Manual testing only.
- **Resolution:** Add Jest or Mocha + Supertest for controller/route integration tests.

### I5 — No `.env` support
- **Status:** Open
- **Severity:** High
- **Affected component:** `index.js`, `middlewares/authenticated.js`, `services/jwt.js`
- **Description:** All configuration uses bare `process.env` with hardcoded fallbacks. No `dotenv` or equivalent is loaded, making config management error-prone across environments.
- **Root cause:** `dotenv` never added.
- **Workaround:** Set env vars manually in shell before running.
- **Resolution:** Add `dotenv` to dependencies; add `require('dotenv').config()` at top of `index.js`; create `.env.example`.

### I6 — `uploads/` directory not auto-created
- **Status:** Open
- **Severity:** Medium
- **Affected component:** `middlewares/upload.js`
- **Description:** Multer will crash if `./uploads/users/` or `./uploads/publications/` don't exist. The directories are not created programmatically.
- **Root cause:** No bootstrap step to create directories.
- **Workaround:** Create directories manually before running.
- **Resolution:** Add `fs.mkdirSync(dir, { recursive: true })` in `upload.js` or in `index.js` bootstrap.

---

## Risks

### R1 — JWT secret in source control
- **Probability:** High (already in repository)
- **Impact:** Critical — any party with repo access can issue valid tokens for any user
- **Affected component:** `services/jwt.js`, `middlewares/authenticated.js`
- **Mitigation:** Rotate secret immediately, move to `process.env.JWT_SECRET`, add to `.gitignore`/secrets manager.
- **Description:** The hardcoded secret `'Secret_Key1-2-3.'` is committed to git history and exposed to all contributors.

### R2 — Local disk file storage not suitable for production
- **Probability:** High (any multi-instance or cloud deployment)
- **Impact:** High — image uploads written to `./uploads/` are lost on restart/redeploy; not shared across multiple server instances
- **Affected component:** `controllers/user.js`, `controllers/publication.js`
- **Mitigation:** Migrate file storage to an object store (S3, GCS, or similar) before production deployment.
- **Description:** Files are stored on the local filesystem. This works for single-instance local development but fails in any containerized or multi-instance environment. JSP requires cloud storage for profile photos, education certificates, and publication images.

### R3 — Wildcard CORS in production
- **Probability:** High (configuration unchanged from dev)
- **Impact:** Medium — any origin can make credentialed requests to the API
- **Affected component:** `app.js`
- **Mitigation:** Replace `*` with an explicit allowed origins list via environment variable before going live.
- **Description:** `Access-Control-Allow-Origin: *` is set globally with no origin restriction.

### R4 — Mongoose 5.x + MongoDB driver compatibility
- **Probability:** Medium (depends on MongoDB server version)
- **Impact:** Medium — some Mongoose 5.x APIs (`Model.count()`) are deprecated and removed in later versions
- **Affected component:** `controllers/user.js` (`Follow.count()`, `Publication.count()`)
- **Mitigation:** Upgrade to Mongoose 7+ and replace `.count()` with `.countDocuments()`.
- **Description:** `Follow.count()` and `Publication.count()` are called in `getCountFollow()`. These are deprecated in Mongoose 5 and removed in Mongoose 7+.

### R5 — No input validation or sanitization
- **Probability:** High (no validation library present)
- **Impact:** High — NoSQL injection possible via unvalidated `req.body` fields passed directly to Mongoose queries
- **Affected component:** All controllers
- **Mitigation:** Add `express-validator` or `joi` to validate and sanitize all input fields before database operations.
- **Description:** Fields like `email`, `nick`, and `userId` from request body/params are used directly in Mongoose queries without validation.

### R6 — JSP recommendation engine cold-start problem
- **Probability:** High (new platform with no data)
- **Impact:** High — HU-JSP05 requires sufficient profile and job data to produce meaningful recommendations; ML model cannot be trained on an empty dataset
- **Affected component:** `services/recommendation.js` (planned)
- **Mitigation:** Implement rule-based weighted scoring (skills 40%, experience 30%, etc.) as Phase 1; layer in ML-based refinement in Phase 2 after sufficient data is collected.
- **Description:** The JSP RFC specifies machine learning for recommendations but the platform starts with zero data. A pure ML approach at launch will fail to produce useful results.

### R7 — JSP architectural scope vs current monolith
- **Probability:** High (RFC calls for microservices)
- **Impact:** Medium — JSP RFC suggests microservices with API Gateway, PostgreSQL + MongoDB, Redis, Elasticsearch, RabbitMQ. The current codebase is a single Express monolith with MongoDB only.
- **Affected component:** Entire codebase
- **Mitigation:** Implement JSP features within the existing monolith first (modular controllers/services). Extract microservices only when load or team scaling demands it.
- **Description:** Premature decomposition into microservices adds significant DevOps overhead without immediate benefit at early stage.

### R8 — GDPR / CCPA compliance not implemented
- **Probability:** High (if platform handles EU/CA users)
- **Impact:** High — JSP RFC explicitly requires GDPR + CCPA compliance; current codebase has no consent tracking, data deletion, or audit trail
- **Affected component:** All user data controllers
- **Mitigation:** Add consent fields to User model; implement data export and deletion endpoints; log all data access and mutations.
- **Description:** The platform collects PII (name, email, location, work history). Compliance is non-negotiable if serving EU or California users.

---

## Known Limitations

| # | Component | Limitation | Acceptable? |
|---|-----------|-----------|-------------|
| 1 | File uploads | Filenames preserved as-is (`file.originalname`) — collisions possible if two users upload files with the same name | No — use UUID-based names in production |
| 2 | Pagination | `mongoose-pagination` adds `.paginate()` method globally; incompatible with Mongoose 7+ | No — requires upgrade |
| 3 | Message `viewed` field | Stored as `String` instead of `Boolean` — truthiness checks may behave unexpectedly | Yes — works but should be typed correctly |
| 4 | `connect-multiparty` | Still wired in `routes/user.js` alongside `multer` via `upload.js`; creates temp files on disk even when unused | Yes — legacy; clean up when refactoring |
| 5 | Token field `expired` | Uses custom `expired` field instead of standard JWT `exp` claim — incompatible with standard JWT libraries | Yes — works in isolation, but breaks interoperability |
| 6 | No rate limiting | No throttling on login, register, or any endpoint — brute force attacks possible | No — add `express-rate-limit` before production |
| 7 | Password not hashed before save race condition | `bcrypt.hash()` callback assigns `user.password = hash`, but `user.save()` is called in a sibling callback — hash may not be set before save | No — refactor to sequential async/await |
| 8 | Single user type | Current `User` model has no `userType` field — cannot distinguish professional from Empresa | No — required for JSP HU-JSP01 |
| 9 | No email service | No email sending capability — email verification (HU-JSP01), recovery (HU-JSP02), and digests (HU-JSP05) are blocked | No — must add before JSP registration ships |
| 10 | No search | No full-text or structured search — HU-JSP05 job filtering requires at minimum MongoDB text indexes | No — required for recommendations |

---

## Knowledge Base Gaps

| Area | Missing Information | Source File Expected | Priority |
|------|--------------------|--------------------|---------|
| Testing | Jest/Supertest integration test patterns for Express + Mongoose | `ai_reactive_framework/4-assisted_code_layer/testing/testing_template.md` | P0 |
| Security | Input validation patterns (express-validator/joi), rate limiting | `ai_reactive_framework/2-core_layer/` | P0 |
| Architecture | Patterns for layered service extraction (controller → service → repository) | `ai_reactive_framework/2-core_layer/architecture_specification/patterns_design_catalog.md` | P1 |
| Observability | Logging strategy, error tracking (no logger or APM configured) | `ai_reactive_framework/3-observability_layer/` | P1 |
| Recommendation | ML-based matching algorithm patterns, cold-start strategies | `ai_reactive_framework/2-core_layer/` | P1 |
| Email | Transactional email patterns (verification, digest, notifications) | `ai_reactive_framework/2-core_layer/` | P1 |
| GDPR | Data consent, export, and deletion implementation patterns | `ai_reactive_framework/2-core_layer/` | P2 |

---

## Build & Infrastructure Issues

| # | Issue | Component | Status |
|---|-------|-----------|--------|
| 1 | `pify` missing from `package.json` — upload handlers may fail on clean install | `controllers/user.js`, `controllers/publication.js` | Open |
| 2 | No `.env` support — all config via bare `process.env` with hardcoded fallbacks | `index.js`, `middlewares/authenticated.js`, `services/jwt.js` | Open |
| 3 | No `engines.npm` field — compatible npm version undocumented | `package.json` | Open |
| 4 | `uploads/` directory not created automatically — app crashes if directory is missing | `middlewares/upload.js` | Open |
| 5 | No CI/CD pipeline — JSP RFC requires automated testing and code review for all features | Project root | Open |
| 6 | No Docker/container configuration — JSP RFC targets cloud deployment but no Dockerfile exists | Project root | Open |

---

## Resolved Issues

_No resolved issues documented at this time._
