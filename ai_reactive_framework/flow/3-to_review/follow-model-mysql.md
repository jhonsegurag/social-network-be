---
feature: follow-model-mysql
phase: to_review
review_requested: 2026-05-26
priority: P0
created: 2026-05-26
source: ai_reactive_framework/context/4-plan.md
---

# Business Specification — follow-model-mysql

---

## 1. Objective

This feature replaces the Mongoose `Follow` schema in `models/follow.js` with a Sequelize model backed by a MySQL `follows` table using integer foreign keys to the `users` table, and updates all dependent code (`controllers/follow.js` and the follow-graph helpers in `controllers/user.js`) to use the Sequelize API. It exists because the social graph is the second critical domain after User — every feed, counter, and profile view depends on follow relationships — and the `followThisUser`, `followUserIds`, and `getCountFollow` helpers in `controllers/user.js` are currently left in a transitional Mongoose state from the `user-model-mysql` feature. The developer benefits by having a fully MySQL-backed follow/unfollow, following/followed listing, and counter flow once this feature is complete.

---

## 2. Scope

| In scope | Out of scope |
|----------|-------------|
| Rewrite `models/follow.js` as a Sequelize model with `userId` and `followedId` FK columns | Migrating existing MongoDB follow documents to MySQL |
| Update `controllers/follow.js` to replace all Mongoose API calls with Sequelize equivalents | Implementing Publication or Message models |
| Update `followThisUser`, `followUserIds`, and `getCountFollow` helpers in `controllers/user.js` to use Sequelize | Changing the follow endpoint routes or authentication middleware |
| Define `belongsTo` associations on the Follow model (→ User as follower, → User as followed) | Adding pagination to follow listing endpoints beyond existing page/limit pattern |

---

## 3. Actors

| Actor | Description |
|-------|-------------|
| Developer | Implements the model rewrite, verifies follow/unfollow and listing endpoints work against MySQL |
| Express HTTP server | Routes requests through `routes/follow.js` to `controllers/follow.js` |
| MySQL server | Stores follow relationships in the `follows` table; enforces FK constraints to `users` |
| Authenticated user | Creates or deletes follow relationships; queries their own social graph |

---

## 4. User Stories

### Story 1 — Follow and unfollow another user

**Given** a logged-in user sends `POST /api/follow` with `{ followed: <userId> }`,
**When** the controller creates a row in the MySQL `follows` table with `userId = req.user.sub` and `followedId = req.body.followed`,
**Then** the response confirms the follow was saved; a subsequent `DELETE /api/follow/:id` removes that row and confirms deletion.

### Story 2 — List who a user is following

**Given** a logged-in user sends `GET /api/following/:id?/:page?`,
**When** the controller queries the `follows` table with `WHERE userId = :id` and joins/loads the associated `User` records,
**Then** the response returns a paginated list of users being followed with `total` and `pages`.

### Story 3 — Profile counters reflect MySQL follow data

**Given** a logged-in user sends `GET /api/counters/:id?`,
**When** `getCountFollow` in `controllers/user.js` queries the MySQL `follows` table using Sequelize `count({ where: { userId } })` and `count({ where: { followedId } })`,
**Then** the response returns accurate `{ following, followed, publications }` counts sourced from MySQL.

---

## 5. Acceptance Criteria

- [ ] `models/follow.js` exports a Sequelize `Model` with columns `id` (INT PK AUTO), `userId` (INT FK → users.id), `followedId` (INT FK → users.id), `createdAt`, `updatedAt`; no Mongoose schema remains.
- [ ] `controllers/follow.js` uses only Sequelize API (`findOne`, `create`, `destroy`, `findAndCountAll`); all `mongoose` and `Model.find()` / `Model.save()` / `Model.remove()` calls are removed.
- [ ] `followThisUser`, `followUserIds`, and `getCountFollow` helpers in `controllers/user.js` use Sequelize `Follow` API; all residual Mongoose `Follow` calls (`.exec()`, `.countDocuments()`) are removed.
- [ ] `POST /api/follow` creates a row in MySQL and returns the saved follow object; `DELETE /api/follow/:id` deletes the row and returns a confirmation.
- [ ] `GET /api/following/:id?/:page?` and `GET /api/followed/:id?/:page?` return paginated results using `findAndCountAll({ limit: 10, offset })`.
- [ ] `GET /api/counters/:id?` returns correct `following` and `followed` counts sourced from MySQL.

---

## 6. API Contract

### Affected endpoints (unchanged from client perspective)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `POST` | `/api/follow` | JWT | Body: `{ followed: <integer userId> }` |
| `DELETE` | `/api/follow/:id` | JWT | `:id` is the Follow row `id` (integer) |
| `GET` | `/api/following/:id?/:page?` | JWT | Lists users that `:id` follows |
| `GET` | `/api/followed/:id?/:page?` | JWT | Lists users that follow `:id` |
| `GET` | `/api/get-my-follows/:followed?` | JWT | Returns follow/followed status for current user |

### `models/follow.js` — exported interface

```js
const Follow = require('./models/follow');

// Create
const follow = await Follow.create({ userId: req.user.sub, followedId: req.body.followed });

// Read
const follow = await Follow.findOne({ where: { userId, followedId } });
const { count, rows } = await Follow.findAndCountAll({
    where: { userId: id },
    limit, offset,
    include: [{ model: User, as: 'followedUser' }],
});

// Delete
await Follow.destroy({ where: { id } });

// Count (used in getCountFollow)
const following = await Follow.count({ where: { userId: user_id } });
const followed  = await Follow.count({ where: { followedId: user_id } });
```

### Response shape — unchanged for clients

```json
{ "follow": { "id": 1, "userId": 3, "followedId": 7 } }
```

### Error shape

```json
{ "message": "human-readable message" }
```

HTTP status: `200` (success / business error), `404` (not found), `500` (server error).

---

## 7. Business Rules

| # | Rule | Rationale |
|---|------|-----------|
| BR-01 | `models/follow.js` must only define the Sequelize model and its associations; no business logic or controller imports | Keeps the model layer pure; prevents circular dependencies with `User` |
| BR-02 | The `followedId` FK references `users.id` and `userId` FK references `users.id` — both must be declared as `belongsTo(User)` associations so Sequelize can join user data in listing queries | Enables `include: [User]` in `findAndCountAll` without raw SQL joins |
| BR-03 | A user must not be able to follow themselves — `userId !== followedId` must be checked in `saveFollow` before inserting | Prevents self-follow rows that would corrupt counter and feed logic |
| BR-04 | `DELETE /api/follow/:id` must verify that the follow row's `userId` matches `req.user.sub` before deleting — users may only delete their own follow relationships | Prevents one user from severing another user's follow relationship |
| BR-05 | All integer ID comparisons between `req.params.id` (string) and Sequelize integer fields must use `parseInt` to avoid type-mismatch silent failures | `req.params` values are always strings; Sequelize returns integers |

---

## 8. State Transitions

Not applicable — this feature migrates a data model and its controller; it does not introduce new entity lifecycle states.

---

## 9. Error Cases

| Scenario | Error Type | HTTP Status | Message |
|----------|-----------|-------------|---------|
| `followed` field missing from `POST /api/follow` body | `bad_request_error` | 200 | `"Invalid Data."` |
| User tries to follow themselves | `conflict` | 200 | `"You cannot follow yourself."` |
| Follow row not found on `DELETE` | `not_found_error` | 404 | `"Follow Not Found."` |
| Caller does not own the follow row on `DELETE` | `forbidden_error` | 500 | `"You do not have permissions to delete this follow."` |
| Sequelize query fails (connection lost, FK violation) | `internal_server_error` | 500 | `"Request Error."` |
| `sequelize` not installed | `dependency_error` | — (crash) | `Cannot find module 'sequelize'` — run `npm install` |

---

## 10. Non-Functional Requirements

| Attribute | Target |
|-----------|--------|
| Latency (p99) | < 200 ms per follow endpoint (indexed FK lookups on `userId`, `followedId`) |
| Availability | 99.9% — dependent on MySQL server uptime |
| Throughput | Sequelize default pool (5 connections) sufficient for single-instance development |
| Data sensitivity | Non-PII — follow relationships contain only integer user IDs |
| Referential integrity | MySQL FK constraints on `userId` and `followedId` → `users.id` must be enforced at the DB level |

---

## 11. Dependencies

| System / File | Type | Purpose |
|--------------|------|---------|
| `sequelize@^6` | npm package | ORM — model definition, associations, `findOne`, `findAndCountAll`, `create`, `destroy`, `count` |
| `mysql2@^3` | npm package | MySQL protocol driver (transitive via Sequelize) |
| `config/database.js` | internal module | Sequelize instance — provided by `mysql-connection-setup` |
| `models/user.js` | internal module | Target of `belongsTo` associations; must be the Sequelize version from `user-model-mysql` |
| `controllers/user.js` | internal module | Contains `followThisUser`, `followUserIds`, `getCountFollow` — updated as part of this feature |
| `ai_reactive_framework/context/0-context.md` | embedded knowledge base | Tech stack, architecture, controller patterns, pagination conventions |
| `ai_reactive_framework/context/4-plan.md` | embedded knowledge base | Feature definition, MySQL schema, files to create/update |
| `ai_reactive_framework/1-business_layer/templates/business_rules_template.md` | embedded knowledge base | Specification structure |

---

## 12. Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| OQ-01 | Should `GET /api/get-my-follows/:followed?` return the full Follow row or just the `followedId` integer list? The current Mongoose implementation returns raw follow documents — clarify expected shape for the Sequelize version. | Developer | — |
| OQ-02 | Should the `follows` table have a UNIQUE constraint on `(userId, followedId)` to prevent duplicate follow rows at the DB level, in addition to the application-level `findOne` check? | Developer | — |
