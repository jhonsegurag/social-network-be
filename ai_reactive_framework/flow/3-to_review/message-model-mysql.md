---
feature: message-model-mysql
phase: to_review
review_requested: 2026-05-26
priority: P0
created: 2026-05-26
source: ai_reactive_framework/context/4-plan.md
---

# Business Specification — message-model-mysql

---

## 1. Objective

This feature replaces the Mongoose `Message` schema in `models/message.js` with a Sequelize model backed by a MySQL `messages` table using integer FKs to the `users` table, and rewrites `controllers/message.js` to use the Sequelize API. It exists because direct messaging is the last Mongoose-dependent domain — until it is migrated, the application cannot fully remove its Mongoose dependency and transition to a pure MySQL data layer. The current model stores `viewed` as a String (`'true'`/`'false'`) and `created_at` as a moment unix string, both of which are type-incorrect and unreliable. The developer benefits by having a fully MySQL-backed send, inbox, outbox, conversation, unviewed count, and mark-as-viewed flow with correct Boolean and DATETIME types once this feature is complete.

---

## 2. Scope

| In scope | Out of scope |
|----------|-------------|
| Rewrite `models/message.js` as a Sequelize model with `emitterId` and `receiverId` FK columns and `viewed` as BOOLEAN | Migrating existing MongoDB message documents to MySQL |
| Update `controllers/message.js` to replace all Mongoose API calls with Sequelize equivalents | Implementing any new messaging features (read receipts, reactions, attachments) |
| Fix `viewed` type: String `'true'`/`'false'` → Boolean `true`/`false` | Changing message endpoint routes or authentication middleware |
| Remove `created_at` moment unix string — replaced by Sequelize `createdAt` DATETIME | Adding push notifications or real-time WebSocket delivery |
| Define two `belongsTo(User)` associations on the Message model (→ emitter, → receiver) | Removing or merging `getConversation` and `getConversation2` endpoints |

---

## 3. Actors

| Actor | Description |
|-------|-------------|
| Developer | Implements the model rewrite, verifies all message endpoints work against MySQL |
| Express HTTP server | Routes requests through `routes/message.js` to `controllers/message.js` |
| MySQL server | Stores messages in the `messages` table; enforces FK constraints to `users` |
| Authenticated user | Sends messages, reads inbox/outbox, views conversations, marks messages as read |

---

## 4. User Stories

### Story 1 — Send a message

**Given** a logged-in user sends `POST /api/message` with `{ text: "hi", receiver: <userId> }`,
**When** the controller inserts a row in MySQL `messages` with `emitterId = req.user.sub`, `receiverId = params.receiver`, `text = params.text`, `viewed = false`,
**Then** the response returns the saved message object with `viewed: false` (Boolean).

### Story 2 — Read inbox and outbox

**Given** a logged-in user sends `GET /api/my-messages/:page?` (received) or `GET /api/messages/:page?` (sent),
**When** the controller queries `messages` with `WHERE receiverId = userId` or `WHERE emitterId = userId`, ordered by `createdAt DESC`, with limit/offset pagination,
**Then** the response returns `{ messages, total, pages }` sourced from MySQL with associated User records joined.

### Story 3 — Unviewed count and mark as viewed

**Given** a logged-in user sends `GET /api/unviewed-messages`,
**When** the controller calls `Message.count({ where: { receiverId: userId, viewed: false } })`,
**Then** the response returns `{ unviewed: <integer> }`; a subsequent `GET /api/set-viewed-messages` sets `viewed = true` for all unread messages for that receiver.

---

## 5. Acceptance Criteria

- [ ] `models/message.js` exports a Sequelize `Model` with columns `id` (INT PK AUTO), `emitterId` (INT FK → users.id), `receiverId` (INT FK → users.id), `text` (TEXT), `viewed` (BOOLEAN default false), `createdAt`, `updatedAt`; no Mongoose schema, `created_at` string, or `viewed` String remains.
- [ ] `controllers/message.js` uses only Sequelize API (`create`, `findAndCountAll`, `count`, `update`); all `mongoose`, `Model.find()`, `Model.save()`, `Model.count().exec()`, `Model.update()` callback, `.paginate()`, and `moment().unix()` calls are removed.
- [ ] `POST /api/message` creates a row in MySQL with `viewed = false` (Boolean) and returns the saved message object.
- [ ] `GET /api/my-messages/:page?` and `GET /api/messages/:page?` return paginated results using `findAndCountAll({ limit: 10, offset })` with associated User records.
- [ ] `GET /api/conversation/:user/:page?` returns paginated bilateral conversation using `findAndCountAll({ where: { emitterId: { [Op.in]: [userId, userId2] }, receiverId: { [Op.in]: [userId, userId2] } }, limit: 30, offset })`.
- [ ] `GET /api/conversation2/:page?` returns all messages involving the authenticated user using `findAndCountAll({ where: { [Op.or]: [{ emitterId: userId }, { receiverId: userId }] }, limit: 30, offset })`.
- [ ] `GET /api/unviewed-messages` returns `{ unviewed: <count> }` using `Message.count({ where: { receiverId: userId, viewed: false } })`.
- [ ] `GET /api/set-viewed-messages` marks all unread messages as viewed using `Message.update({ viewed: true }, { where: { receiverId: userId, viewed: false } })`.

---

## 6. API Contract

### Affected endpoints (unchanged from client perspective)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `POST` | `/api/message` | JWT | Body: `{ text: <string>, receiver: <integer userId> }` |
| `GET` | `/api/my-messages/:page?` | JWT | Received messages (inbox) |
| `GET` | `/api/messages/:page?` | JWT | Sent messages (outbox) |
| `GET` | `/api/unviewed-messages` | JWT | Count of unread received messages |
| `GET` | `/api/set-viewed-messages` | JWT | Mark all received messages as viewed |
| `GET` | `/api/conversation/:user/:page?` | JWT | Bilateral conversation with `:user` |
| `GET` | `/api/conversation2/:page?` | JWT | All messages involving the current user |

### `models/message.js` — exported interface

```js
const { Op } = require('sequelize');
const Message = require('./models/message');

// Create
const msg = await Message.create({ emitterId, receiverId, text, viewed: false });

// Read paginated (inbox)
const { count, rows } = await Message.findAndCountAll({
    where: { receiverId: userId },
    limit, offset,
    order: [['createdAt', 'DESC']],
    include: [{ model: User, as: 'emitter' }],
});

// Read paginated (bilateral conversation)
const { count, rows } = await Message.findAndCountAll({
    where: {
        emitterId: { [Op.in]: [userId, userId2] },
        receiverId: { [Op.in]: [userId, userId2] },
    },
    limit: 30, offset,
    order: [['createdAt', 'DESC']],
    include: [{ model: User, as: 'emitter' }, { model: User, as: 'receiver' }],
});

// Count unviewed
const unviewed = await Message.count({ where: { receiverId: userId, viewed: false } });

// Mark as viewed
await Message.update({ viewed: true }, { where: { receiverId: userId, viewed: false } });
```

### Response shape — unchanged for clients

```json
{ "message": { "id": 1, "emitterId": 2, "receiverId": 5, "text": "hi", "viewed": false } }
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
| BR-01 | `models/message.js` must only define the Sequelize model and its two `belongsTo(User)` associations; no business logic | Keeps the model layer pure; prevents circular dependencies |
| BR-02 | `emitterId` and `receiverId` FKs must each be declared as `belongsTo(User)` with distinct aliases (`as: 'emitter'` and `as: 'receiver'`) so Sequelize can join both user records in conversation queries | Enables `include: [emitter, receiver]` in `findAndCountAll` without raw SQL; two FKs to the same table require explicit aliases |
| BR-03 | `viewed` must be stored as BOOLEAN (`true`/`false`), not as the legacy String `'true'`/`'false'` — all queries must use Boolean literals | The original String type causes silent truthiness failures (`'false'` is truthy in JS); Boolean storage is correct and SQL-native |
| BR-04 | `created_at` (moment unix string) is removed; `createdAt` (Sequelize DATETIME) replaces it; all sort/order clauses must use `[['createdAt', 'DESC']]` | Sequelize manages timestamps automatically; unix strings are unreliable for SQL ordering |
| BR-05 | All integer ID comparisons between `req.params.user` (string) and Sequelize integer fields must use `parseInt` | `req.params` values are always strings; Sequelize returns integers |
| BR-06 | `saveMessage` must validate that both `params.text` and `params.receiver` are present before inserting | Prevents orphaned or undeliverable messages with null fields |

---

## 8. State Transitions

```
[viewed: false] ──GET /api/set-viewed-messages──► [viewed: true]
```

| From | Trigger | To | Guard condition |
|------|---------|-----|----------------|
| `viewed: false` | `GET /api/set-viewed-messages` | `viewed: true` | `receiverId = req.user.sub` |

---

## 9. Error Cases

| Scenario | Error Type | HTTP Status | Message |
|----------|-----------|-------------|---------|
| `text` or `receiver` missing from `POST /api/message` body | `bad_request_error` | 200 | `"Please, send the message text and receiver..."` |
| Message not saved (Sequelize constraint violation) | `internal_server_error` | 500 | `"Sending message error..."` |
| No messages found in inbox/outbox query | `not_found_error` | 404 | `"No messages..."` |
| Sequelize query fails (connection lost, FK violation) | `internal_server_error` | 500 | `"Get messages error..."` |
| `setViewedMessages` query fails | `internal_server_error` | 500 | `"Set messages error..."` |

---

## 10. Non-Functional Requirements

| Attribute | Target |
|-----------|--------|
| Latency (p99) | < 200 ms per message endpoint (indexed FK lookups on `receiverId`, `emitterId`) |
| Availability | 99.9% — dependent on MySQL server uptime |
| Throughput | Sequelize default pool (5 connections) sufficient for single-instance development |
| Data sensitivity | Potentially sensitive — message text may contain PII; no encryption required at this stage |
| Referential integrity | MySQL FK constraints on `emitterId` and `receiverId` → `users.id` must be enforced at the DB level |

---

## 11. Dependencies

| System / File | Type | Purpose |
|--------------|------|---------|
| `sequelize@^6` | npm package | ORM — model definition, associations, `findAndCountAll`, `create`, `count`, `update`, `Op.in`, `Op.or` |
| `mysql2@^3` | npm package | MySQL protocol driver (transitive via Sequelize) |
| `config/database.js` | internal module | Sequelize instance — provided by `mysql-connection-setup` |
| `models/user.js` | internal module | Target of both `belongsTo` associations; must be the Sequelize version from `user-model-mysql` |
| `ai_reactive_framework/context/0-context.md` | embedded knowledge base | Tech stack, architecture, controller patterns, pagination conventions |
| `ai_reactive_framework/context/4-plan.md` | embedded knowledge base | Feature definition, MySQL schema, files to create/update |

---

## 12. Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| OQ-01 | `getConversation` uses `emitterId IN [userId, userId2] AND receiverId IN [userId, userId2]` which matches messages between the two users but also would match a message from userId to themselves if userId === userId2. Should this be rewritten as `OR ((emitterId=A AND receiverId=B) OR (emitterId=B AND receiverId=A))` for exactness? | Developer | — |
| OQ-02 | `setViewedMessages` currently uses a GET request to perform a state mutation — should it be changed to a PATCH/PUT for REST correctness, or kept as GET for backward compatibility with the existing client? | Developer | — |
