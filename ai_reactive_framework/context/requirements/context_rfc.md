# RFC: social-network-be — Service Architecture

## Overview

**social-network-be** is a Node.js REST API backend for a simple social media network built with the MEAN stack (MongoDB, Express, Angular, Node). It exposes endpoints for user registration/login, a follow/unfollow social graph, timeline publications with optional image attachments, and direct messaging between users.

The service is synchronous and request/response based. Authentication is stateless JWT-based (HS256 via `jwt-simple`). There is no event-driven processing, message queue, or background worker.

---

## Architecture

### Execution Model

HTTP requests flow through a middleware chain and land in controller functions that call Mongoose models directly.

```
HTTP Request
      ↓
app.js (body-parser, CORS headers)
      ↓
routes/<domain>.js (Express Router)
      ↓
middlewares/authenticated.js (JWT guard — skipped on public routes)
      ↓
controllers/<domain>.js (business logic + Mongoose queries)
      ↓
models/<domain>.js (Mongoose schema → MongoDB)
```

---

## Layers

### 1. `Bootstrap` — `index.js`
- **Role:** Application entry point
- **Goal:** Connect to MongoDB via Mongoose, then start Express server.
- **Config:** `PORT` (default 3000), `MONGODB_URL` (default `mongodb://localhost:27017/social`)

### 2. `App` — `app.js`
- **Role:** Express configuration
- **Goal:** Register body-parser, global CORS headers, and mount all route groups under `/` and `/api`.

### 3. `Routes` — `routes/`
- **Role:** Endpoint definitions
- **Goal:** Map HTTP method + path to controller handler; apply `ensureAuth` middleware to protected routes.
- **Files:** `default.js`, `user.js`, `follow.js`, `publication.js`, `message.js`

### 4. `Controllers` — `controllers/`
- **Role:** Business logic + database access
- **Goal:** Read request params/body, query or mutate MongoDB via Mongoose models, return HTTP response.
- **Notes:** No separate service layer — helpers like `followThisUser()`, `getCountFollow()` are defined as local async functions within the controller file.

### 5. `Models` — `models/`
- **Role:** Data schema definitions
- **Goal:** Define Mongoose schemas and export models.
- **Files:** `user.js`, `follow.js`, `publication.js`, `message.js`

### 6. `Middlewares` — `middlewares/`
- **Role:** Cross-cutting concerns
- **Files:**
  - `authenticated.js` — JWT guard; decodes token, validates expiry, populates `req.user`
  - `upload.js` — Multer factory; creates disk-storage upload handler for a given directory and field name

### 7. `Services` — `services/`
- **Role:** Utility helpers
- **Files:**
  - `jwt.js` — Creates JWT token payload with 3-day expiry

---

## Key Patterns

### JWT Authentication

```js
// services/jwt.js — token creation
var payload = {
    sub: user._id, name: user.name, nick: user.nick, email: user.email,
    role: user.role, image: user.image,
    iat: moment().unix(),
    expired: moment().add(3, 'days').unix()   // custom field, not standard 'exp'
};
return jwt.encode(payload, secret);

// middlewares/authenticated.js — token validation
var token = req.headers.authorization.replace(/['"]+/g, '');
var payload = jwt.decode(token, secret);
if (payload.expired <= moment().unix()) { /* reject */ }
req.user = payload;
```

**Issue:** Secret is hardcoded as `'Secret_Key1-2-3.'` in both files. Must be moved to `process.env.JWT_SECRET`.

### File Upload

```js
// middlewares/upload.js
exports.buildFile = function(dir, type) {
    let storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, dir),
        filename: (req, file, cb) => cb(null, file.originalname)
    });
    return multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } }).single(type);
};

// In controller
let buildObject = pify(upload.buildFile("./uploads/users/", "image"));
await buildObject(req, res);
```

### Pagination

```js
User.find().sort('_id').paginate(page, itemsPerPage, (err, users, total) => {
    res.status(200).send({ users, total, pages: Math.ceil(total / itemsPerPage) });
});
// Default itemsPerPage: 10
```

### Follow Graph

Follow relationships are stored as documents in the `Follow` collection (`user` → `followed`).
- `followThisUser(a, b)` — checks if `a` follows `b` AND if `b` follows `a`
- `followUserIds(userId)` — returns all IDs the user follows and all IDs that follow the user

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 18.x |
| HTTP framework | Express.js | ^4.16.4 |
| Database | MongoDB (Mongoose ODM) | ^5.13.22 |
| Authentication | jwt-simple | ^0.5.5 |
| Password hashing | bcrypt-nodejs | 0.0.3 |
| File upload | multer | ^1.4.5-lts.1 |
| File upload (legacy) | connect-multiparty | ^2.2.0 |
| Body parsing | body-parser | ^1.18.3 |
| Pagination | mongoose-pagination | ^1.0.0 |
| Date utilities | moment | ^2.24.0 |
| Dev server | nodemon | ^1.18.9 |

---

## Domain Models

### User
```
name, surname, nick, email, password (bcrypt), role, image
```

### Follow
```
user (ObjectId → User), followed (ObjectId → User)
```

### Publication
```
text, file, created_at, user (ObjectId → User)
```

### Message
```
emitter (ObjectId → User), receiver (ObjectId → User), text, created_at, viewed (String)
```

---

## Key Directories

| Path | Purpose |
|------|---------|
| `index.js` | Bootstrap: MongoDB connection + server listen |
| `app.js` | Express: body-parser, CORS, route mounts |
| `routes/` | Endpoint definitions per domain |
| `controllers/` | Business logic + Mongoose calls |
| `models/` | Mongoose schemas |
| `middlewares/` | JWT guard, multer upload factory |
| `services/` | JWT token creation utility |
| `uploads/users/` | User avatar images (local disk) |
| `uploads/publications/` | Publication images (local disk) |
| `ai_reactive_framework/` | AI crew knowledge base and feature lifecycle |

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | HTTP listen port |
| `MONGODB_URL` | `mongodb://localhost:27017/social` | MongoDB connection string |
| `JWT_SECRET` | *(hardcoded — not yet env-based)* | JWT signing secret |

---

## Known Issues

1. **Hardcoded JWT secret** — `'Secret_Key1-2-3.'` in source code (Critical)
2. **`pify` not in `package.json`** — used but undeclared (High)
3. **`bcrypt-nodejs` deprecated** — broken on Node 18+ (High)
4. **No test suite** — `npm test` exits with error (Medium)
5. **`Model.count()` deprecated** — must use `countDocuments()` (Medium)
6. **No input validation** — NoSQL injection risk (High)
7. **bcrypt race condition in `saveUser`** — hash may not be set before `save()` (High)
8. **`uploads/` not auto-created** — crashes on missing directory (Medium)
