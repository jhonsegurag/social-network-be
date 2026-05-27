---
feature: replace-bcrypt-nodejs
phase: to_review
review_requested: 2026-05-26
priority: P0
created: 2026-05-26
source: ai_reactive_framework/context/4-plan.md
---

# Business Specification — replace-bcrypt-nodejs

---

## 1. Objective

This feature removes the deprecated, unmaintained `bcrypt-nodejs@0.0.3` package from the project and replaces it with `bcryptjs@^2`, a pure-JavaScript maintained alternative. It also fixes the async race condition in `controllers/user.js` `saveUser` where `bcrypt.hash()` was invoked in a callback but `user.save()` was potentially called before the hash was assigned to `user.password`. The developer benefits by having a secure, Node.js 18-compatible password hashing flow with no native binding requirements, eliminating issue I3 and unblocking user registration and login on Node.js 18.x environments.

---

## 2. Scope

| In scope | Out of scope |
|----------|-------------|
| Remove `bcrypt-nodejs` from `package.json` dependencies | Migrating existing bcrypt hashes stored in the database |
| Add `bcryptjs@^2` to `package.json` dependencies | Changing password hashing algorithm (bcrypt rounds remain 10) |
| Update `controllers/user.js` to `require('bcryptjs')` and use `async/await` pattern | Adding password strength validation |
| Fix `saveUser` race condition: `const hash = await bcryptjs.hash(password, 10)` before `user.save()` | Changing authentication middleware or JWT logic |

---

## 3. Actors

| Actor | Description |
|-------|-------------|
| Developer | Updates `package.json` and `controllers/user.js`; runs `npm install` to apply changes |
| Express HTTP server | Handles `POST /api/register` and `POST /api/login` through the updated `saveUser` / `loginUser` handlers |
| Node.js 18 runtime | Executes the pure-JS `bcryptjs` without requiring native bindings |
| Authenticated user | Registers an account and logs in — unaffected from the client perspective |

---

## 4. User Stories

### Story 1 — User registers successfully on Node.js 18

**Given** a user sends `POST /api/register` with valid name, surname, nick, email, and password,
**When** `saveUser` calls `await bcryptjs.hash(params.password, 10)` and then `await user.save()` sequentially,
**Then** the user row is saved to the database with a valid bcrypt hash and the response returns the created user object — with no native binding errors thrown.

### Story 2 — User logs in with bcryptjs comparison

**Given** a registered user sends `POST /api/login` with correct email and password,
**When** `loginUser` calls `await bcryptjs.compare(params.password, user.password)`,
**Then** the comparison returns `true` and the response returns a JWT token — identical behaviour to the pre-migration bcrypt-nodejs flow.

### Story 3 — Clean install works without native build tools

**Given** a developer runs `npm install` on a fresh machine without `node-gyp` or build tools,
**When** npm resolves dependencies from `package.json`,
**Then** `bcryptjs` installs successfully (pure JS, no native compilation) and the server starts without module-not-found or binding errors.

---

## 5. Acceptance Criteria

- [ ] `package.json` does not contain `bcrypt-nodejs`; it contains `bcryptjs@^2` in `dependencies`.
- [ ] `controllers/user.js` imports `bcryptjs` (not `bcrypt-nodejs`); no reference to `bcrypt-nodejs` remains anywhere in the codebase.
- [ ] `saveUser` uses `const hash = await bcryptjs.hash(params.password, 10)` before calling `user.save()` — hash is guaranteed to be set before the save call.
- [ ] `loginUser` uses `await bcryptjs.compare(params.password, user.password)` — no callback-based comparison remains.
- [ ] `npm install` completes without native compilation errors on a clean Node.js 18 environment.

---

## 6. API Contract

### Affected endpoints (unchanged from client perspective)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `POST` | `/api/register` | — | Password hashed with `bcryptjs.hash(password, 10)` |
| `POST` | `/api/login` | — | Password verified with `bcryptjs.compare(input, hash)` |

### `controllers/user.js` — hashing pattern

```js
const bcryptjs = require('bcryptjs');

// saveUser — hash before save (fixes race condition)
const hash = await bcryptjs.hash(params.password, 10);
const user = User.build({ ...params, password: hash });
const userStored = await user.save();

// loginUser — compare
const check = await bcryptjs.compare(params.password, user.password);
if (!check) return res.status(500).send({ message: 'Wrong email or password.' });
```

### Response shape — unchanged for clients

Registration and login responses are identical to the pre-migration shape; only the internal hashing library changes.

### Error shape

```json
{ "message": "human-readable message" }
```

---

## 7. Business Rules

| # | Rule | Rationale |
|---|------|-----------|
| BR-01 | `bcrypt-nodejs` must be fully removed from `package.json` and all `require()` calls — no fallback or conditional import | A deprecated package with known vulnerabilities must not remain even as an unused dependency |
| BR-02 | Salt rounds must remain 10 (`bcryptjs.hash(password, 10)`) — do not change the cost factor | Changing rounds would invalidate all existing password hashes stored in the database |
| BR-03 | `bcryptjs.hash()` must be called with `await` and its result assigned to `password` before `user.save()` is called | The original callback pattern allowed `save()` to be called before the hash was ready, storing a plaintext or undefined password |
| BR-04 | `bcryptjs.compare()` must be called with `await` — no callback-based comparison | Consistent async/await style; prevents unhandled promise rejection if comparison throws |

---

## 8. State Transitions

Not applicable — this feature replaces a dependency and fixes an async bug; it does not introduce new entity lifecycle states.

---

## 9. Error Cases

| Scenario | Error Type | HTTP Status | Message |
|----------|-----------|-------------|---------|
| `bcryptjs.hash()` throws (e.g. invalid rounds) | `internal_server_error` | 500 | `"Saving user error."` (caught by existing try/catch) |
| `bcryptjs.compare()` throws | `internal_server_error` | 500 | `"Login error."` (caught by existing try/catch) |
| `bcrypt-nodejs` still present after migration | `dependency_error` | — (crash on Node 18) | `"Error: bcrypt-nodejs is not compatible..."` — run `npm uninstall bcrypt-nodejs && npm install bcryptjs` |

---

## 10. Non-Functional Requirements

| Attribute | Target |
|-----------|--------|
| Latency (p99) | `bcryptjs` hash at rounds=10 ≈ 100 ms — same order of magnitude as `bcrypt-nodejs` |
| Availability | 99.9% — no new external dependencies introduced |
| Compatibility | Node.js 18.x, pure JS — no native build tools required |
| Data sensitivity | Password hashes — never returned in API responses; `user.password = undefined` before sending |

---

## 11. Dependencies

| System / File | Type | Purpose |
|--------------|------|---------|
| `bcryptjs@^2` | npm package | Pure-JS bcrypt implementation — drop-in replacement for `bcrypt-nodejs` |
| `controllers/user.js` | internal module | Contains `saveUser` (hash) and `loginUser` (compare) — the two functions that use bcrypt |
| `package.json` | project manifest | Dependency list — `bcrypt-nodejs` removed, `bcryptjs` added |
| `ai_reactive_framework/context/0-context.md` | embedded knowledge base | Tech stack, async/await conventions, Node.js 18 compatibility requirements |
| `ai_reactive_framework/context/4-plan.md` | embedded knowledge base | Feature definition, risk I3 description, files to update |

---

## 12. Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| OQ-01 | Are there any existing bcrypt-nodejs hashes in the database that need to be re-hashed or verified to be compatible with bcryptjs? (bcryptjs is format-compatible with bcrypt-nodejs — existing hashes should verify correctly.) | Developer | — |
| OQ-02 | Should `npm uninstall bcrypt-nodejs` be run explicitly, or is removing it from `package.json` and running `npm install` sufficient for the project's deployment pipeline? | Developer | — |
