---
feature: fix-jwt-secret
phase: to_review
review_requested: 2026-05-26
priority: P0
created: 2026-05-26
source: ai_reactive_framework/context/4-plan.md
---

# Business Specification — fix-jwt-secret

---

## 1. Objective

This feature removes the hardcoded JWT signing secret `'Secret_Key1-2-3.'` from `services/jwt.js` and `middlewares/authenticated.js` and replaces it with `process.env.JWT_SECRET` loaded from the environment via dotenv. It exists because the current hardcoded secret is committed to git history and visible to all repository contributors, meaning any party with repo access can forge valid JWT tokens for any user ID. The developer benefits by having a cryptographically safe authentication flow where the secret can be rotated without code changes, resolving critical issue I1 and risk R1.

---

## 2. Scope

| In scope | Out of scope |
|----------|-------------|
| Replace `var secret = 'Secret_Key1-2-3.'` in `services/jwt.js` with `const secret = process.env.JWT_SECRET` | Changing the JWT library (`jwt-simple`) or token format |
| Replace `var secret = 'Secret_Key1-2-3.'` in `middlewares/authenticated.js` with `const secret = process.env.JWT_SECRET` | Implementing token refresh or revocation |
| Add `JWT_SECRET=<value>` to `.env` (and ensure `.env` is in `.gitignore`) | Rotating or invalidating tokens already issued with the old secret |
| Add `JWT_SECRET` to `.env.example` as a documented placeholder | Adding role-based access control |

---

## 3. Actors

| Actor | Description |
|-------|-------------|
| Developer | Updates `services/jwt.js`, `middlewares/authenticated.js`, and `.env`; rotates the secret value |
| Express HTTP server | Signs tokens at login (`services/jwt.js`) and validates tokens on protected routes (`middlewares/authenticated.js`) using the env-sourced secret |
| Node.js process | Reads `JWT_SECRET` from `process.env` at startup (populated by dotenv in `index.js`) |
| Authenticated user | Logs in and receives a JWT — behaviour unchanged from the client perspective |

---

## 4. User Stories

### Story 1 — Secret sourced from environment

**Given** the `.env` file contains `JWT_SECRET=<a strong random value>` and `index.js` calls `require('dotenv').config()` at startup,
**When** `services/jwt.js` calls `jwt.encode(payload, process.env.JWT_SECRET)`,
**Then** the token is signed with the env value — not the hardcoded string — and the hardcoded `'Secret_Key1-2-3.'` is absent from the source files.

### Story 2 — Token validation uses the same env secret

**Given** a client sends a request with a JWT signed by `process.env.JWT_SECRET`,
**When** `middlewares/authenticated.js` calls `jwt.decode(token, process.env.JWT_SECRET)`,
**Then** the decode succeeds and `req.user` is populated; a token signed with the old hardcoded secret is rejected.

### Story 3 — Secret rotation does not require code changes

**Given** a developer updates `JWT_SECRET` in `.env` and restarts the server,
**When** the application starts,
**Then** all new tokens are signed with the new secret; old tokens become invalid — no source code changes required to rotate.

---

## 5. Acceptance Criteria

- [ ] `services/jwt.js` uses `const secret = process.env.JWT_SECRET` — the string `'Secret_Key1-2-3.'` does not appear in the file.
- [ ] `middlewares/authenticated.js` uses `const secret = process.env.JWT_SECRET` — the string `'Secret_Key1-2-3.'` does not appear in the file.
- [ ] `.env` contains a `JWT_SECRET=<value>` entry with a non-empty secret value.
- [ ] `.env.example` contains `JWT_SECRET=your_jwt_secret_here` as a documented placeholder.
- [ ] `.gitignore` contains a `.env` entry (already present from `mysql-connection-setup`; confirm it covers `JWT_SECRET`).
- [ ] The string `'Secret_Key1-2-3.'` does not appear anywhere in the codebase (verified by grep).

---

## 6. API Contract

### Affected files

| File | Change |
|------|--------|
| `services/jwt.js` | `var secret = 'Secret_Key1-2-3.'` → `const secret = process.env.JWT_SECRET` |
| `middlewares/authenticated.js` | `var secret = 'Secret_Key1-2-3.'` → `const secret = process.env.JWT_SECRET` |
| `.env` | Add `JWT_SECRET=<strong_random_value>` |
| `.env.example` | Add `JWT_SECRET=your_jwt_secret_here` |

### Affected endpoints (unchanged from client perspective)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `POST` | `/api/login` | — | Token signed with `process.env.JWT_SECRET` |
| All protected routes | `*` | JWT | Token decoded with `process.env.JWT_SECRET` |

### Error shape — unchanged

```json
{ "message": "Forbidden: Invalid Token." }
{ "message": "Expired Token." }
```

---

## 7. Business Rules

| # | Rule | Rationale |
|---|------|-----------|
| BR-01 | The string `'Secret_Key1-2-3.'` must not appear in any source file after this feature is implemented | The old secret is compromised by its presence in git history; leaving it in code provides a false fallback |
| BR-02 | `process.env.JWT_SECRET` must be read at module load time (top-level `const`), not inside the function body | Reading it inside the function would silently use `undefined` if dotenv hasn't loaded, signing tokens with an empty key |
| BR-03 | `.env` must not be committed to the repository — `.gitignore` must include `.env` | The entire purpose of this feature is to keep secrets out of source control |
| BR-04 | `.env.example` must document `JWT_SECRET` so new developers know the variable is required | Without documentation, a fresh clone will fail at runtime with a cryptic jwt error rather than a clear missing-env message |
| BR-05 | Both `services/jwt.js` (token creation) and `middlewares/authenticated.js` (token validation) must use the same env variable — they must not diverge | If the two files use different secrets, tokens will be created but never validate, breaking all authenticated endpoints |

---

## 8. State Transitions

Not applicable — this feature replaces a hardcoded value with an environment variable; it does not introduce new entity lifecycle states.

---

## 9. Error Cases

| Scenario | Error Type | HTTP Status | Message |
|----------|-----------|-------------|---------|
| `JWT_SECRET` not set in environment at startup | `startup_error` | — (crash or silent) | `jwt.encode` called with `undefined` key — tokens will be invalid; add startup validation to fail fast |
| Token signed with old hardcoded secret presented after migration | `forbidden_error` | 403 | `"Forbidden: Invalid Token."` (jwt.decode throws — caught by try/catch) |
| Token signed with `undefined` key (JWT_SECRET missing) | `forbidden_error` | 403 | `"Forbidden: Invalid Token..."` (jwt.decode throws) |

---

## 10. Non-Functional Requirements

| Attribute | Target |
|-----------|--------|
| Latency (p99) | No measurable change — `process.env` reads are synchronous and O(1) |
| Availability | 99.9% — dependent on correct `.env` configuration at deployment |
| Security | JWT secret must be a minimum of 32 random characters; never committed to source control |
| Data sensitivity | `JWT_SECRET` is a secret credential — treat as a password; never log or return in responses |

---

## 11. Dependencies

| System / File | Type | Purpose |
|--------------|------|---------|
| `dotenv@^16` | npm package | Loads `.env` file into `process.env` at bootstrap — must be configured in `index.js` before any other module reads env vars |
| `services/jwt.js` | internal module | Token creation — reads `JWT_SECRET` for `jwt.encode` |
| `middlewares/authenticated.js` | internal module | Token validation — reads `JWT_SECRET` for `jwt.decode` |
| `.env` | local config file | Holds `JWT_SECRET` value — not committed to git |
| `.env.example` | documentation file | Documents required env vars for new developers |
| `ai_reactive_framework/context/0-context.md` | embedded knowledge base | Tech stack, environment variable conventions |
| `ai_reactive_framework/context/4-plan.md` | embedded knowledge base | Feature definition, I1/R1 risk descriptions |

---

## 12. Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| OQ-01 | Should the startup validation (`index.js` required env check) be extended to include `JWT_SECRET` in the list of required variables, so the server fails fast with a clear error if it is missing? | Developer | — |
| OQ-02 | All existing tokens signed with `'Secret_Key1-2-3.'` will become invalid after deployment. Should existing sessions be gracefully invalidated (e.g. via a notice to logged-in users) or is a hard cutover acceptable? | Developer | — |
