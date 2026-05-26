---
feature: replace-pagination
phase: to_review
review_requested: 2026-05-26
priority: P1
created: 2026-05-26
source: ai_reactive_framework/context/4-plan.md
---

# Business Specification — replace-pagination

---

## 1. Objective

This feature removes `mongoose-pagination` from the project and replaces every paginated list endpoint with SQL-native `limit`/`offset` pagination via Sequelize's `findAndCountAll`. It exists because `mongoose-pagination` is a Mongoose-specific package that is meaningless after the MongoDB → MySQL migration, and because all controllers must return consistent `{ items, total, pages }` response shapes so the frontend can render paginated lists without breaking changes. The developer benefits by having a clean, dependency-free pagination pattern that is uniform across all four controller domains (user, follow, publication, message) and that does not rely on any external pagination library.

---

## 2. Scope

| In scope | Out of scope |
|----------|-------------|
| Remove `mongoose-pagination` from `package.json` dependencies | Adding cursor-based or keyset pagination |
| Implement `limit`/`offset` pagination in all list endpoints in `controllers/user.js` | Adding pagination to endpoints that return a single record |
| Implement `limit`/`offset` pagination in all list endpoints in `controllers/follow.js` | Adding server-side filtering, sorting configurability beyond `order: [['id','ASC']]` |
| Implement `limit`/`offset` pagination in all list endpoints in `controllers/publication.js` | Frontend client changes |
| Implement `limit`/`offset` pagination in all list endpoints in `controllers/message.js` | Changing the URL shape of pagination params (`:page` stays) |
| Standardise response shape to `{ items: rows, total: count, pages: Math.ceil(count/limit) }` across all list endpoints | Adding page size as a request parameter |

---

## 3. Actors

| Actor | Description |
|-------|-------------|
| Developer | Verifies all list endpoints return the standard paginated response and that `mongoose-pagination` is absent from the dependency tree |
| Express HTTP server | Executes `findAndCountAll` with `limit`/`offset` derived from `req.params.page` for every list endpoint |
| Frontend client | Reads `items`, `total`, and `pages` from every list response to render paginated UI — behaviour unchanged from pre-migration contract |
| Sequelize ORM | Applies `LIMIT` and `OFFSET` clauses to SQL queries; returns `{ count, rows }` destructured into the standard response shape |

---

## 4. User Stories

### Story 1 — List endpoints return paginated results

**Given** the database contains more than 10 users / follows / publications / messages,
**When** a client sends `GET /api/users/:page` (or the equivalent list endpoint) with `page=2`,
**Then** the response contains `{ items: [...10 records], total: <N>, pages: <ceil(N/10)> }` and the `items` array starts from offset 10 — with no `mongoose-pagination` involved in producing that result.

### Story 2 — Page 1 default when param is absent or invalid

**Given** a client sends a list request with no `:page` param or with `:page=0`,
**When** the controller resolves the page value,
**Then** `parseInt(req.params.page) || 1` evaluates to `1`, offset is `0`, and the first 10 records are returned.

### Story 3 — Response shape is consistent across all four controller domains

**Given** a client calls any list endpoint (users, follows, publications, messages),
**When** the response is received,
**Then** it always contains the top-level keys `items` (array), `total` (integer), and `pages` (integer) — no `docs`, `page`, or Mongoose-specific pagination keys appear.

---

## 5. Acceptance Criteria

- [ ] `package.json` does **not** contain `mongoose-pagination` in `dependencies` or `devDependencies`.
- [ ] `controllers/user.js` list functions use `User.findAndCountAll({ limit, offset })` and respond with `{ items: rows, total: count, pages: Math.ceil(count / limit) }`.
- [ ] `controllers/follow.js` list functions (`getFollowingUsers`, `getFollowedUser`) use `Follow.findAndCountAll({ limit, offset })` and respond with the standard shape.
- [ ] `controllers/publication.js` list functions (`getPublications`, `getPublicationsUser`) use `Publication.findAndCountAll({ limit, offset })` and respond with the standard shape.
- [ ] `controllers/message.js` list functions (`getReceivedMessages`, `getEmmitMessages`, `getConversation`, `getConversation2`) use `Message.findAndCountAll({ limit, offset })` and respond with the standard shape.
- [ ] No controller file contains a call to `mongoose-pagination`'s `.paginate()` method or requires the `mongoose-pagination` package.

---

## 6. API Contract

### Affected endpoints (pagination parameter unchanged)

All list endpoints accept `:page` as an integer route param (1-indexed). The response shape changes from the Mongoose-paginate format to the standard shape below.

### Request (unchanged)

| Param | Type | Required | Validation |
|-------|------|----------|------------|
| `:page` | `integer` | No (defaults to 1) | `parseInt(req.params.page) \|\| 1` |

### Response — 200 OK (standardised)

```json
{
  "items": [{ "...": "record fields" }],
  "total": 42,
  "pages": 5
}
```

| Field | Type | Description |
|-------|------|-------------|
| `items` | `array` | The records for this page (max `limit` entries) |
| `total` | `integer` | Total count of matching records across all pages |
| `pages` | `integer` | `Math.ceil(total / limit)` |

### Response — Error

```json
{ "message": "Internal server error.", "status": 500 }
```

---

## 7. Business Rules

| # | Rule | Rationale |
|---|------|-----------|
| BR-01 | Page number defaults to `1` when `:page` is absent, `0`, or non-numeric — use `parseInt(req.params.page) \|\| 1` | Prevents negative or zero offsets from producing unexpected SQL results |
| BR-02 | Default `limit` is `10` for all list endpoints; it must not be controlled by the client | A fixed page size prevents unbounded queries that could DoS the database |
| BR-03 | Response must use `items` (not `docs`, `data`, or `results`) and `total` / `pages` as top-level keys | Frontend contract — Mongoose-paginate used `docs`; standardising on `items` removes the legacy key |
| BR-04 | `mongoose-pagination` must be removed from `package.json` — not merely unused | An unused dependency still inflates the install size and creates a false impression that Mongoose is still in the dependency graph |
| BR-05 | `findAndCountAll` must be used (not two separate `count` + `findAll` calls) | A single query is atomic and avoids a race condition where the count and the rows diverge between two queries |

---

## 8. State Transitions

Not applicable — this feature replaces a pagination library with a built-in ORM pattern; it does not introduce new entity lifecycle states.

---

## 9. Error Cases

| Scenario | Error Type | HTTP Status | Message |
|----------|-----------|-------------|---------|
| Database query fails during `findAndCountAll` | `internal_server_error` | 500 | `"Internal server error."` (caught by try/catch; original error logged) |
| `:page` param is non-numeric | — (silent default) | — | `parseInt(req.params.page) \|\| 1` silently coerces to page 1 — no error response |
| `:page` is beyond the last page | 200 (empty items) | 200 | `{ items: [], total: N, pages: M }` — empty array, no 404 |

---

## 10. Non-Functional Requirements

| Attribute | Target |
|-----------|--------|
| Latency (p99) | No measurable regression — `LIMIT`/`OFFSET` on indexed columns is O(log n + limit); same order as the Mongoose paginate plugin |
| Availability | 99.9% — no new external dependency introduced |
| Compatibility | Sequelize v6 `findAndCountAll` is stable; no Node.js version constraint beyond what Sequelize already requires (Node 12+) |
| Data sensitivity | Non-PII (pagination metadata only) |

---

## 11. Dependencies

| System / File | Type | Purpose |
|--------------|------|---------|
| `sequelize@^6` | npm package | Provides `findAndCountAll({ limit, offset })` — the replacement for mongoose-pagination |
| `controllers/user.js` | internal module | List endpoints: `getUsers` — uses `User.findAndCountAll` |
| `controllers/follow.js` | internal module | List endpoints: `getFollowingUsers`, `getFollowedUser` — use `Follow.findAndCountAll` |
| `controllers/publication.js` | internal module | List endpoints: `getPublications`, `getPublicationsUser` — use `Publication.findAndCountAll` |
| `controllers/message.js` | internal module | List endpoints: `getReceivedMessages`, `getEmmitMessages`, `getConversation`, `getConversation2` — use `Message.findAndCountAll` |
| `package.json` | project manifest | `mongoose-pagination` must be absent from the dependency list |
| `ai_reactive_framework/context/0-context.md` | embedded knowledge base | Tech stack, architecture, controller patterns |
| `ai_reactive_framework/context/4-plan.md` | embedded knowledge base | Pagination pattern definition, affected files list |

---

## 12. Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| OQ-01 | Should the page size (`limit = 10`) be extracted to a shared constant or config variable, or kept inline in each controller? | Developer | — |
| OQ-02 | Should endpoints that currently return all records (e.g. `getMyFollows`, `followUserIds`) also be paginated, or remain unbounded? | Developer | — |
