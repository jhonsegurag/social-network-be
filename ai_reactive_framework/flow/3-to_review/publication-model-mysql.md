---
feature: publication-model-mysql
phase: to_review
review_requested: 2026-05-26
priority: P0
created: 2026-05-26
source: ai_reactive_framework/context/4-plan.md
---

# Business Specification — publication-model-mysql

---

## 1. Objective

This feature replaces the Mongoose `Publication` schema in `models/publication.js` with a Sequelize model backed by a MySQL `publications` table using an integer FK to the `users` table, and updates all dependent code (`controllers/publication.js` and the `getCountFollow` counter helper in `controllers/user.js`) to use the Sequelize API. It exists because publications are the core content of the social feed — every timeline query, user profile counter, and image upload depends on the Publication model — and `controllers/publication.js` currently uses Mongoose callbacks, `mongoose-pagination`, and a `created_at` string field that must be replaced by Sequelize timestamps. The developer benefits by having a fully MySQL-backed publication creation, deletion, image upload, timeline feed, and counter flow once this feature is complete.

---

## 2. Scope

| In scope | Out of scope |
|----------|-------------|
| Rewrite `models/publication.js` as a Sequelize model with `userId` FK column and Sequelize timestamps | Migrating existing MongoDB publication documents to MySQL |
| Update `controllers/publication.js` to replace all Mongoose API calls with Sequelize equivalents | Implementing Message model |
| Remove `moment()` unix string from `created_at` — replaced by Sequelize `createdAt` | Changing publication endpoint routes or authentication middleware |
| Update `getCountFollow` in `controllers/user.js` to use `Publication.count({ where: { userId } })` | Adding new publication features (likes, comments, reactions) |
| Define `belongsTo(User)` association on the Publication model | Removing or replacing the `uploadImage` (legacy connect-multiparty) handler |

---

## 3. Actors

| Actor | Description |
|-------|-------------|
| Developer | Implements the model rewrite, verifies all publication endpoints work against MySQL |
| Express HTTP server | Routes requests through `routes/publication.js` to `controllers/publication.js` |
| MySQL server | Stores publications in the `publications` table; enforces FK constraint to `users` |
| Authenticated user | Creates and deletes publications; views their own or timeline feed |

---

## 4. User Stories

### Story 1 — Create and delete a publication

**Given** a logged-in user sends `POST /api/publication` with `{ text: "hello" }`,
**When** the controller inserts a row in MySQL `publications` with `userId = req.user.sub` and `text = params.text`,
**Then** the response returns the saved publication object; a subsequent `DELETE /api/publication/:id` removes that row and returns a confirmation.

### Story 2 — View the social timeline feed

**Given** a logged-in user sends `GET /api/publications/:page?`,
**When** the controller queries the `follows` table to get the list of `followedId` values, then queries `publications` with `WHERE userId IN (followedIds, self)` ordered by `createdAt DESC` with limit/offset pagination,
**Then** the response returns `{ publications, total_items, pages, page, item_per_page }` sourced from MySQL.

### Story 3 — Profile publication counter

**Given** a logged-in user sends `GET /api/counters/:id?`,
**When** `getCountFollow` in `controllers/user.js` calls `Publication.count({ where: { userId } })`,
**Then** the response includes an accurate `publications` count sourced from MySQL.

---

## 5. Acceptance Criteria

- [ ] `models/publication.js` exports a Sequelize `Model` with columns `id` (INT PK AUTO), `text` (TEXT), `file` (VARCHAR(255) nullable), `userId` (INT FK → users.id), `createdAt`, `updatedAt`; no Mongoose schema or `created_at` string field remains.
- [ ] `controllers/publication.js` uses only Sequelize API (`create`, `findByPk`, `findAndCountAll`, `update`, `destroy`); all `mongoose`, `Model.find()`, `Model.save()`, `Model.remove()`, `Model.findByIdAndUpdate()`, `.paginate()`, and `moment().unix()` calls are removed.
- [ ] `getCountFollow` in `controllers/user.js` uses `Publication.count({ where: { userId: parseInt(user_id) } })`; the `Publication.countDocuments()` call is removed.
- [ ] `POST /api/publication` creates a row in MySQL and returns the publication object; `DELETE /api/publication/:id` verifies ownership and deletes the row.
- [ ] `GET /api/publications/:page?` returns a paginated timeline feed using `findAndCountAll({ where: { userId: { [Op.in]: [...followedIds, selfId] } }, limit: 10, offset })`.
- [ ] `GET /api/publications/user/:user?/:page?` returns paginated publications for a specific user using `findAndCountAll({ where: { userId }, limit: 10, offset })`.
- [ ] `GET /api/counters/:id?` returns the correct `publications` count sourced from MySQL.

---

## 6. API Contract

### Affected endpoints (unchanged from client perspective)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `POST` | `/api/publication` | JWT | Body: `{ text: <string> }` |
| `GET` | `/api/publications/:page?` | JWT | Timeline feed — posts from followed users + self |
| `GET` | `/api/publications/user/:user?/:page?` | JWT | Publications by a specific user |
| `GET` | `/api/publication/:id` | JWT | Single publication by row `id` |
| `DELETE` | `/api/publication/:id` | JWT | `:id` is the Publication row `id` (integer) |
| `POST` | `/api/publication/upload-image-migrate/:id` | JWT | Upload publication image (multer/pify) |
| `GET` | `/api/publication/image/:imageFile` | — | Serve publication image file |

### `models/publication.js` — exported interface

```js
const { Op } = require('sequelize');
const Publication = require('./models/publication');

// Create
const pub = await Publication.create({ text, file: null, userId: req.user.sub });

// Read one
const pub = await Publication.findByPk(id, { include: [{ model: User, as: 'author' }] });

// Read paginated (timeline)
const { count, rows } = await Publication.findAndCountAll({
    where: { userId: { [Op.in]: [...followedIds, selfId] } },
    limit, offset,
    order: [['createdAt', 'DESC']],
    include: [{ model: User, as: 'author' }],
});

// Update (image upload)
await Publication.update({ file: filename }, { where: { id, userId: req.user.sub } });

// Delete
await Publication.destroy({ where: { id, userId: req.user.sub } });

// Count (used in getCountFollow)
const publications = await Publication.count({ where: { userId: parseInt(user_id) } });
```

### Response shape — unchanged for clients

```json
{ "publication": { "id": 1, "text": "hello", "file": null, "userId": 3, "createdAt": "..." } }
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
| BR-01 | `models/publication.js` must only define the Sequelize model and its `belongsTo(User)` association; no business logic | Keeps the model layer pure; prevents circular dependencies |
| BR-02 | The `userId` FK references `users.id` and must be declared as `belongsTo(User, { foreignKey: 'userId', as: 'author' })` so Sequelize can join user data in listing queries | Enables `include: [{ model: User, as: 'author' }]` in `findAndCountAll` without raw SQL |
| BR-03 | `DELETE /api/publication/:id` must use `Publication.destroy({ where: { id, userId: req.user.sub } })` — ownership enforced at the query level, not application level | Prevents one user deleting another user's publication; avoids a race between findOne+destroy |
| BR-04 | `created_at` (moment unix string) is removed; `createdAt` (Sequelize DATETIME) replaces it; all sort/order clauses must use `[['createdAt', 'DESC']]` | Sequelize manages timestamps automatically; string unix timestamps are not reliably sortable across engines |
| BR-05 | All integer ID comparisons between `req.params.id`/`req.params.user` (string) and Sequelize integer fields must use `parseInt` | `req.params` values are always strings; Sequelize returns integers |
| BR-06 | `getPublications` (timeline feed) must include the authenticated user's own publications alongside their followed users' publications (`[...followedIds, selfId]`) | Consistent with the original Mongoose implementation that pushed `req.user.sub` into the follows array |

---

## 8. State Transitions

Not applicable — this feature migrates a data model and its controller; it does not introduce new entity lifecycle states.

---

## 9. Error Cases

| Scenario | Error Type | HTTP Status | Message |
|----------|-----------|-------------|---------|
| `text` field missing from `POST /api/publication` body | `bad_request_error` | 200 | `"Text field is required."` |
| Publication row not found on `GET /api/publication/:id` | `not_found_error` | 404 | `"Publication not found."` |
| No file attached to image upload request | `bad_request_error` | 400 | `"Please upload a file!"` |
| Uploaded file extension is not png/jpg/jpeg/gif | `bad_request_error` | 200 | `"Ups, please upload a valid image file."` |
| File size exceeds 2 MB | `payload_too_large` | 500 | `"File size cannot be larger than 2MB!"` |
| Sequelize query fails (connection lost, FK violation) | `internal_server_error` | 500 | `"Request Error."` |

---

## 10. Non-Functional Requirements

| Attribute | Target |
|-----------|--------|
| Latency (p99) | < 200 ms per publication endpoint (indexed FK lookup on `userId`) |
| Availability | 99.9% — dependent on MySQL server uptime |
| Throughput | Sequelize default pool (5 connections) sufficient for single-instance development |
| Data sensitivity | Non-PII — publication text and image filenames |
| Referential integrity | MySQL FK constraint on `userId` → `users.id` must be enforced at the DB level |

---

## 11. Dependencies

| System / File | Type | Purpose |
|--------------|------|---------|
| `sequelize@^6` | npm package | ORM — model definition, associations, `findByPk`, `findAndCountAll`, `create`, `update`, `destroy`, `count`, `Op.in` |
| `mysql2@^3` | npm package | MySQL protocol driver (transitive via Sequelize) |
| `config/database.js` | internal module | Sequelize instance — provided by `mysql-connection-setup` |
| `models/user.js` | internal module | Target of `belongsTo` association; must be the Sequelize version from `user-model-mysql` |
| `models/follow.js` | internal module | Queried in `getPublications` to build the timeline `userId IN (...)` list; must be the Sequelize version from `follow-model-mysql` |
| `controllers/user.js` | internal module | Contains `getCountFollow` — `Publication.countDocuments` call updated as part of this feature |
| `middlewares/upload.js` | internal module | Multer pify wrapper for image uploads — unchanged |
| `ai_reactive_framework/context/0-context.md` | embedded knowledge base | Tech stack, architecture, controller patterns, pagination conventions |
| `ai_reactive_framework/context/4-plan.md` | embedded knowledge base | Feature definition, MySQL schema, files to create/update |

---

## 12. Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| OQ-01 | Should the `uploadImage` handler (legacy `connect-multiparty` / `req.files` path) be removed entirely in favour of `uploadImageMigrate` (multer/pify), or kept for backward compatibility? | Developer | — |
| OQ-02 | Should the timeline feed (`getPublications`) include the authenticated user's own publications? The original Mongoose code pushes `req.user.sub` into the follows array — confirm this is the intended behaviour. | Developer | — |
