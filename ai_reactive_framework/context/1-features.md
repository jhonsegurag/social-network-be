# Implementation Plan — social-network-be

## Development Workflow

All features follow the AI-assisted reactive framework lifecycle:

```
1. /rf_to_do      → generate business spec in flow/1-to_do/
2. /rf_wip        → move to active development in flow/2-wip/
3. /rf_implement  → implement feature code from wip spec
4. /rf_review     → move to flow/3-to_review/
5. /rf_done       → merge and archive in flow/4-done/
```

---

## Layer Implementation Pattern

Every new domain feature follows this vertical slice, top to bottom:

```
1. Mongoose schema     → models/<domain>.js
2. Route definitions   → routes/<domain>.js
3. Controller handlers → controllers/<domain>.js
4. Middleware (if new) → middlewares/<name>.js
5. Route mount         → app.js
```

### Checklist per layer

**Mongoose Model**
- Define schema fields with proper types and references (`Schema.ObjectId` + `ref`).
- Export via `mongoose.model('<ModelName>', schema)`.
- No business logic inside the model file.

**Routes**
- Import controller and `md_auth` middleware.
- Apply `md_auth.ensureAuth` to all protected routes.
- Use `connect-multiparty` or `multer` (via `middlewares/upload.js`) for file upload routes.
- Mount under `/api` prefix in `app.js`.

**Controller**
- Read params from `req.params`, `req.query`, or `req.body`.
- Get authenticated user identity from `req.user.sub` (set by `ensureAuth`).
- Call Mongoose models directly — no separate service layer.
- Always send a response: `res.status(xxx).send({...})`.
- Use `async/await` + `pify` for multer upload handlers.
- Default page size for pagination: 10 items (`mongoose-pagination`).

**File Upload Handler**
- Use `middlewares/upload.js` → `upload.buildFile(dir, fieldName)` wrapped in `pify`.
- Validate extension (only `png`, `jpg`, `jpeg`, `gif`).
- Max file size: 2 MB.
- Store files in `./uploads/<domain>/`.
- Serve static files via `GET /get-image-<domain>/:imageFile` → `res.sendFile(path.resolve(...))`.

---

## Key Architectural Decisions

**No service layer.** Controllers call Mongoose models directly. Logic helpers (e.g. `followThisUser`, `followUserIds`, `getCountFollow`) are async functions defined in the same controller file.

**Stateless JWT authentication.** No session store — the token carries full user identity. `req.user` is populated by the `authenticated` middleware from the decoded JWT payload on every request.

**Mixed async style.** Older Mongoose callback-based handlers co-exist with newer `async/await` code. Prefer `async/await` for new handlers.

**File storage is local disk.** Uploaded images go to `./uploads/users/` or `./uploads/publications/`. There is no CDN or object storage integration. File names are preserved as-is from the original upload.

**Wildcard CORS.** `Access-Control-Allow-Origin: *` is set globally. Suitable for development; restrict in production.

**Hardcoded JWT secret.** `'Secret_Key1-2-3.'` is hardcoded in both `services/jwt.js` and `middlewares/authenticated.js`. Must be moved to an environment variable before production deployment.

**Token expiry field is `expired` (not `exp`).** The middleware checks `payload.expired <= moment().unix()`. This is a custom field, not the standard JWT `exp` claim.

---

## Critical Reference Files

| File | Purpose |
|------|---------|
| `index.js` | Bootstrap: MongoDB connection + server listen |
| `app.js` | Express setup: middleware, CORS, route mounting |
| `routes/user.js` | User endpoint definitions |
| `routes/follow.js` | Follow/unfollow endpoint definitions |
| `routes/publication.js` | Publication endpoint definitions |
| `routes/message.js` | Message endpoint definitions |
| `controllers/user.js` | User CRUD, login, image upload, counters |
| `controllers/follow.js` | Follow graph operations |
| `controllers/publication.js` | Publication CRUD, image upload |
| `controllers/message.js` | Message send, inbox, conversation, viewed state |
| `models/user.js` | User Mongoose schema |
| `models/follow.js` | Follow relationship schema |
| `models/publication.js` | Publication schema |
| `models/message.js` | Message schema |
| `middlewares/authenticated.js` | JWT guard — populates `req.user` |
| `middlewares/upload.js` | Multer factory for file uploads |
| `services/jwt.js` | JWT token creation utility |
| `ai_reactive_framework/context/` | Runtime context files managed by `/rf_*` commands |
| `ai_reactive_framework/flow/` | Feature lifecycle directories |
