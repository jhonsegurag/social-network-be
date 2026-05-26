# Dependencies — social-network-be

## External Dependencies

### Public Registry (npmjs.com)

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.16.4 | HTTP framework — routing, middleware, response helpers |
| `mongoose` | ^5.13.22 | MongoDB ODM — schema definition, model queries, population |
| `mongoose-pagination` | ^1.0.0 | Adds `.paginate(page, limit, cb)` to Mongoose models |
| `body-parser` | ^1.18.3 | Parses JSON and URL-encoded request bodies |
| `jwt-simple` | ^0.5.5 | JWT encode/decode (HS256) — used for token creation and verification |
| `bcrypt-nodejs` | 0.0.3 | Password hashing and comparison |
| `moment` | ^2.24.0 | Token expiry timestamps (`moment().add(3, 'days').unix()`) |
| `multer` | ^1.4.5-lts.1 | Multipart file upload handling (diskStorage) |
| `connect-multiparty` | ^2.2.0 | Legacy multipart upload middleware (still wired in user routes) |
| `pify` | (transitive) | Promisify callback-based functions — used to wrap multer in async handlers |
| `nodemon` | ^1.18.9 | Dev-only: auto-restart on file changes (`npm run local`) |

---

## Internal Dependencies

### Route → Controller Mapping

| Route File | Controller File | Description |
|-----------|----------------|-------------|
| `routes/user.js` | `controllers/user.js` | User CRUD, auth, image upload, follow counters |
| `routes/follow.js` | `controllers/follow.js` | Follow/unfollow, list following/followed |
| `routes/publication.js` | `controllers/publication.js` | Publication CRUD, image upload, timeline |
| `routes/message.js` | `controllers/message.js` | Send message, inbox, conversation, viewed state |
| `routes/default.js` | `controllers/default.js` | Health/welcome response |

### Controller → Model Mapping

| Controller | Models Used |
|-----------|-------------|
| `controllers/user.js` | `User`, `Follow`, `Publication` |
| `controllers/follow.js` | `Follow`, `User` |
| `controllers/publication.js` | `Publication`, `Follow` |
| `controllers/message.js` | `Message`, `User` |

### Middleware Dependencies

| Middleware | Used By | Purpose |
|-----------|---------|---------|
| `middlewares/authenticated.js` | All protected routes | Decode JWT, populate `req.user`, reject expired/invalid tokens |
| `middlewares/upload.js` | `controllers/user.js`, `controllers/publication.js` | Build multer upload handler for a given directory and field name |

### Service Dependencies

| Service | Used By | Purpose |
|---------|---------|---------|
| `services/jwt.js` | `controllers/user.js` (login) | Create JWT token payload with 3-day expiry |

---

## Shared Infrastructure Dependencies

### Authentication Flow

JWT secret is **duplicated** in two files:
- `services/jwt.js` — token creation
- `middlewares/authenticated.js` — token validation

Both use `const secret = 'Secret_Key1-2-3.'`. Any secret rotation must update both files.

### File Upload Pattern

```js
// middlewares/upload.js
exports.buildFile = function(dir, type) {
    let storage = multer.diskStorage({ destination: dir, filename: (req, file, cb) => cb(null, file.originalname) });
    return multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } }).single(type);
};

// In controller (async/await with pify):
let buildObject = pify(upload.buildFile("./uploads/users/", "image"));
await buildObject(req, res);
```

### Pagination Pattern

```js
Model.find().sort('_id').paginate(page, itemsPerPage, (err, items, total) => {
    res.status(200).send({ items, total, pages: Math.ceil(total / itemsPerPage) });
});
```
Default `itemsPerPage`: 10.

---

## Knowledge Base Directory

| Domain | Directory | Files |
|--------|-----------|-------|
| Architecture | `ai_reactive_framework/2-core_layer/architecture_specification/` | patterns_design_catalog.md, architecture_patterns_catalog.md |
| Business templates | `ai_reactive_framework/1-business_layer/templates/` | business_rules_template.md, plan_template.md, dependencies_template.md, issues_template.md |
| Code evaluation | `ai_reactive_framework/4-assisted_code_layer/evaluator/` | backend_app.md |
| Testing | `ai_reactive_framework/4-assisted_code_layer/testing/` | testing_template.md |

---

## Constraints

- `MONGODB_URL` must be set for any non-local environment — defaults to `mongodb://localhost:27017/social`
- JWT secret (`'Secret_Key1-2-3.'`) is hardcoded — must be moved to `process.env.JWT_SECRET` before production
- `bcrypt-nodejs` is deprecated and unmaintained — should be replaced with `bcryptjs` or `bcrypt`
- Mongoose 5.x does not support the latest MongoDB drivers — upgrade path to Mongoose 7+ required for new MongoDB versions
- Uploaded files are stored on local disk — no persistence across deployments or horizontal scaling without shared storage
- `connect-multiparty` creates temp files even on validation failure — temp files must be deleted manually on error paths
- `pify` is not listed in `package.json` — it must be installed or inlined before production use
