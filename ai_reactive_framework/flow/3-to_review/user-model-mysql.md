---
feature: user-model-mysql
phase: to_review
review_requested: 2026-05-26
wip_started: 2026-05-26
priority: P0
created: 2026-05-26
source: ai_reactive_framework/context/4-plan.md
---

# Business Specification — user-model-mysql

---

## 1. Objective

This feature replaces the Mongoose `User` schema in `models/user.js` with a Sequelize model backed by a MySQL `users` table, and updates all dependent code (`controllers/user.js`, `services/jwt.js`, `middlewares/authenticated.js`) to use the Sequelize API. It exists because the project is migrating from MongoDB to MySQL and the User domain is the root entity that every other model (`Follow`, `Publication`, `Message`) references via foreign keys. The developer benefits by having a fully functional user registration, login, profile management, and image upload flow operating against MySQL once this feature is complete.

---

## 2. Scope

| In scope | Out of scope |
|----------|-------------|
| Rewrite `models/user.js` as a Sequelize model with the `users` table schema | Migrating existing MongoDB user documents to MySQL |
| Update `controllers/user.js` to replace all Mongoose API calls with Sequelize equivalents | Implementing the Follow, Publication, or Message models |
| Replace `bcrypt-nodejs` with `bcryptjs` and fix the async race condition in `saveUser` | Adding input validation middleware (tracked separately as a P1 improvement) |
| Update `services/jwt.js` to use `user.id` instead of `user._id` | Changing the JWT token structure or expiry logic |
| Verify `middlewares/authenticated.js` works correctly with integer `sub` values | Adding rate limiting or CORS changes |
| Replace `mongoose-pagination` with Sequelize `findAndCountAll` in user list endpoint | Migrating Follow or Publication controllers |

---

## 3. Actors

| Actor | Description |
|-------|-------------|
| Developer | Implements the model rewrite, runs `npm install`, verifies all user endpoints work against MySQL |
| Express HTTP server | Routes incoming requests through `routes/user.js` to `controllers/user.js` |
| MySQL server | Stores and queries user records via the `users` table created by `sequelize.sync()` |
| JWT middleware | Decodes tokens and reads `req.user.sub` as an integer user ID after this migration |

---

## 4. User Stories

### Story 1 — Register and login a new user

**Given** the MySQL `users` table exists (created by `sequelize.sync()` at startup),
**When** a client sends `POST /api/register` with `{ name, surname, nick, email, password }` followed by `POST /api/login` with `{ email, password, gettoken: true }`,
**Then** the user is saved to MySQL with a bcryptjs-hashed password, and login returns a valid JWT with `sub` set to the integer MySQL `id`.

### Story 2 — Retrieve a user profile with follow status

**Given** an authenticated user sends `GET /api/user/:id` with a valid JWT,
**When** the controller queries MySQL for the target user and checks the Follow table for mutual follow status,
**Then** the response returns `{ user, following, followed }` with the user object sourced from MySQL (no `_id` field — integer `id` instead).

### Story 3 — Paginate the user list

**Given** an authenticated user sends `GET /api/users/:page?`,
**When** the controller queries MySQL using Sequelize `findAndCountAll` with `limit: 10` and `offset: (page-1)*10`,
**Then** the response returns `{ users, user_following, user_follow_me, total, pages }` sourced entirely from MySQL.

---

## 5. Acceptance Criteria

- [ ] `models/user.js` exports a Sequelize `Model` with columns `id`, `name`, `surname`, `nick` (UNIQUE), `email` (UNIQUE), `password`, `role` (default `'ROLE_USER'`), `image` (nullable), `createdAt`, `updatedAt`; no Mongoose schema remains.
- [ ] `controllers/user.js` uses only Sequelize API (`findByPk`, `findOne`, `findAll`, `findAndCountAll`, `create` or `build`+`save`, `update`); all `mongoose`, `mongoose-pagination`, and `Model.find()` / `Model.count()` calls are removed.
- [ ] `saveUser` is refactored to `async/await` using `bcryptjs`; the password hash is assigned before `user.save()` is called — the race condition is eliminated.
- [ ] `services/jwt.js` uses `user.id` (integer) instead of `user._id` for the `sub` claim; the token payload is otherwise unchanged.
- [ ] `GET /api/users/:page?` uses `findAndCountAll({ limit: 10, offset })` and returns `{ users, total, pages }` without `mongoose-pagination`.
- [ ] All six user endpoints (`/register`, `/login`, `/user/:id`, `/users/:page?`, `/counters/:id?`, `/update-user/:id`) return correct responses when tested against a running MySQL instance.

---

## 6. API Contract

### Affected endpoints (unchanged from client perspective)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `POST` | `/api/register` | — | `password` now hashed with bcryptjs |
| `POST` | `/api/login` | — | Returns JWT with integer `sub` |
| `GET` | `/api/user/:id` | JWT | `:id` is now an integer MySQL id |
| `GET` | `/api/users/:page?` | JWT | Pagination via `findAndCountAll` |
| `GET` | `/api/counters/:id?` | JWT | Counts via `Follow.count` / `Publication.count` (Sequelize) |
| `PUT` | `/api/update-user/:id` | JWT | `update` + `findByPk` pattern |

### `models/user.js` — exported interface

```js
const User = require('./models/user');

// Create
const user = User.build({ name, surname, nick, email, role, image });
user.password = hash;
await user.save();

// Read
const user = await User.findByPk(id);
const user = await User.findOne({ where: { email } });
const { count, rows } = await User.findAndCountAll({ limit, offset, order: [['id', 'ASC']] });

// Update
await User.update(fields, { where: { id } });
const updated = await User.findByPk(id);
```

### Response shape — unchanged for clients

```json
{ "user": { "id": 1, "name": "...", "nick": "...", "email": "...", "role": "ROLE_USER", "image": null } }
```

> Note: `_id` (MongoDB ObjectId string) is replaced by `id` (integer). Frontend must be updated if it references `user._id`.

### Error shape

```json
{ "message": "human-readable message" }
```

HTTP status: `200` (success / business error), `400` (bad input), `404` (not found), `500` (server error).

---

## 7. Business Rules

| # | Rule | Rationale |
|---|------|-----------|
| BR-01 | `models/user.js` must only define the Sequelize model and export it — no business logic, no controller imports | Keeps the model layer pure; prevents circular dependencies |
| BR-02 | Password hashing must use `bcryptjs` with salt rounds of `10`; `bcrypt-nodejs` must be removed from `package.json` | `bcrypt-nodejs` is deprecated, broken on Node 18+, and has a known async race condition |
| BR-03 | `saveUser` must validate that all required fields (`name`, `surname`, `nick`, `email`, `password`) are present before querying the database | Prevents empty or partial records being written to MySQL |
| BR-04 | Duplicate `email` or `nick` checks must use a Sequelize `Op.or` query before inserting — a unique constraint violation from MySQL is a fallback, not the primary guard | Provides a consistent `200 { message: "User already exists." }` response rather than a raw SQL error |
| BR-05 | `req.user.sub` contains the integer MySQL `id` after this migration — any code that compares `userId !== req.user.sub` must use loose equality (`!=`) or explicit `parseInt` since `req.params.id` arrives as a string | Prevents authorization checks from failing due to string/integer type mismatch |

---

## 8. State Transitions

Not applicable — this feature migrates a data model and its controller; it does not introduce new entity lifecycle states.

---

## 9. Error Cases

| Scenario | Error Type | HTTP Status | Message |
|----------|-----------|-------------|---------|
| Required registration fields missing | `bad_request_error` | 200 | `"Invalid Data."` (preserves existing client contract) |
| `email` or `nick` already exists in MySQL | `conflict` | 200 | `"User already exists."` |
| Sequelize `findByPk` returns null | `not_found_error` | 404 | `"User Not Found."` |
| bcryptjs `hash` or `compare` throws | `internal_server_error` | 500 | `"Saving user error."` / `"Login error."` |
| Wrong email or password on login | `auth_error` | 500 | `"Wrong email or password."` (preserves existing contract) |
| `userId !== req.user.sub` on update/upload | `forbidden_error` | 500 | `"You do not have permissions to modify the user."` |
| Sequelize query fails (connection lost, syntax) | `internal_server_error` | 500 | `"Request Error."` |
| `mysql2` / `sequelize` not installed | `dependency_error` | — (crash) | `Cannot find module 'sequelize'` — run `npm install` |

---

## 10. Non-Functional Requirements

| Attribute | Target |
|-----------|--------|
| Latency (p99) | < 200 ms per user endpoint (simple PK lookups on indexed `id`, `email`, `nick`) |
| Availability | 99.9% — dependent on MySQL server uptime |
| Throughput | Sequelize default pool (5 connections) sufficient for single-instance development |
| Data sensitivity | PII — `email`, `name`, `surname`, `nick`, `password` (hashed) are personal data; `password` must never be returned in responses |
| Backward compatibility | HTTP response shape must remain identical from the client's perspective; only `_id` → `id` field rename is a known breaking change |

---

## 11. Dependencies

| System / File | Type | Purpose |
|--------------|------|---------|
| `sequelize@^6` | npm package | ORM — model definition, `findByPk`, `findOne`, `findAndCountAll`, `update` |
| `mysql2@^3` | npm package | MySQL protocol driver (transitive via Sequelize) |
| `bcryptjs@^2` | npm package | Password hashing replacement for `bcrypt-nodejs` |
| `config/database.js` | internal module | Sequelize instance — must be created by `mysql-connection-setup` first |
| `models/follow.js` | internal module | Used by `followThisUser` and `followUserIds` helpers in `controllers/user.js` — still Mongoose at this stage; will be replaced in `follow-model-mysql` |
| `models/publication.js` | internal module | Used by `getCountFollow` in `controllers/user.js` — still Mongoose at this stage; will be replaced in `publication-model-mysql` |
| `ai_reactive_framework/context/0-context.md` | embedded knowledge base | Tech stack, architecture, controller patterns, pagination conventions |
| `ai_reactive_framework/context/4-plan.md` | embedded knowledge base | Feature definition, MySQL schema, files to create/update, risks |
| `ai_reactive_framework/1-business_layer/templates/business_rules_template.md` | embedded knowledge base | Specification structure |

---

## 12. Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| OQ-01 | Should the `followThisUser` and `followUserIds` helpers in `controllers/user.js` remain Mongoose-based until `follow-model-mysql` is complete, or should they be stubbed/commented out temporarily? | Developer | — |
| OQ-02 | Should the `id` → `_id` rename in JWT `sub` and API responses be handled with an adapter (e.g. a `toJSON` override on the Sequelize model that aliases `id` as `_id`) to avoid frontend breaking changes? | Developer | — |
