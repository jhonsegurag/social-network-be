# Project Context — social-network-be

## Module

```
social-network-be
```
(`package.json` → `name: "social-network-be"`, entry point: `index.js`)

## Purpose

A **Node.js REST API backend** for a simple social media network built with the MEAN stack (MongoDB, Express, Angular, Node). It exposes CRUD endpoints for user management, a follow/unfollow social graph, timeline publications with image attachments, and direct messaging between users.

The service is not event-driven — it is a synchronous, request/response HTTP API consumed by a frontend client. Authentication is stateless JWT-based.

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

## Architecture

MVC pattern. No service layer abstraction — controllers call Mongoose models directly.

```
app/
├── index.js          ← Bootstrap: Mongoose connect + Express listen
├── app.js            ← Express config: body-parser, CORS, route mounting
├── routes/           ← Route definitions (Express Router)
├── controllers/      ← Business logic + Mongoose calls
├── models/           ← Mongoose schemas and models
├── middlewares/      ← Auth guard, JWT helper, file upload helper
├── services/         ← JWT token creation utility
└── uploads/          ← Local file storage (users/, publications/)
```

### Request Flow

```
HTTP Request
      ↓
app.js (CORS headers, body-parser)
      ↓
routes/<domain>.js (Express Router)
      ↓
middlewares/authenticated.js (JWT guard — skipped on public routes)
      ↓
controllers/<domain>.js (query MongoDB via Mongoose, send response)
      ↓
models/<domain>.js (Mongoose schema + model)
      ↓
MongoDB
```

### Transport

- **Endpoint base**: `http://localhost:3000` (default)
- **Protocol**: HTTP/1.1 REST
- **Auth header**: `Authorization: <jwt_token>`
- **Content-Type**: `application/json` (body-parser) / `multipart/form-data` (file uploads)

## Routes

### User — `/api`

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| `POST` | `/register` | — | `saveUser` |
| `POST` | `/login` | — | `loginUser` |
| `GET` | `/user/:id` | JWT | `getUser` |
| `GET` | `/users/:page?` | JWT | `getUsers` |
| `GET` | `/counters/:id?` | JWT | `getCounters` |
| `PUT` | `/update-user/:id` | JWT | `updateUser` |
| `POST` | `/upload-image-user/:id` | JWT | `uploadImageMigrate` |
| `GET` | `/get-image-user/:imageFile` | — | `getImageFile` |

### Follow — `/api`

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| `POST` | `/follow` | JWT | `saveFollow` |
| `DELETE` | `/follow/:id` | JWT | `deleteFollow` |
| `GET` | `/following/:id?/:page?` | JWT | `getFollowingUsers` |
| `GET` | `/followed/:id?/:page?` | JWT | `getFollowedUser` |
| `GET` | `/get-my-follows/:followed?` | JWT | `getMyFollows` |

### Publication — `/api`

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| `POST` | `/publication` | JWT | `savePublication` |
| `GET` | `/publications/:page?` | JWT | `getPublications` |
| `GET` | `/publications-user/:user/:page?` | JWT | `getPublicationsUser` |
| `GET` | `/publication/:id` | JWT | `getPublication` |
| `DELETE` | `/publication/:id` | JWT | `deletePublication` |
| `POST` | `/upload-image-pub/:id` | JWT | `uploadImageMigrate` |
| `GET` | `/get-image-pub/:imageFile` | — | `getImageFile` |

### Message — `/api`

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| `POST` | `/message` | JWT | `saveMessage` |
| `GET` | `/my-messages/:page?` | JWT | `getReceivedMessages` |
| `GET` | `/messages/:page?` | JWT | `getEmmitMessages` |
| `GET` | `/unviewed-messages` | JWT | `getUnviewedMessages` |
| `GET` | `/set-viewed-messages` | JWT | `setViewedMessages` |
| `GET` | `/conversation/:user/:page?` | JWT | `getConversation` |
| `GET` | `/conversation2/:page?` | JWT | `getConversation2` |

### Default — `/`

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| `GET` | `/` | — | Health / welcome |

## Domain Models (Mongoose)

| Model | Schema Fields |
|-------|---------------|
| `User` | `name`, `surname`, `nick`, `email`, `password` (bcrypt), `role`, `image` |
| `Follow` | `user` (→ User), `followed` (→ User) |
| `Publication` | `text`, `file`, `created_at`, `user` (→ User) |
| `Message` | `emitter` (→ User), `receiver` (→ User), `text`, `created_at`, `viewed` |

## Authentication

- Library: `jwt-simple`
- Secret: hardcoded string `'Secret_Key1-2-3.'`
- Token payload: `{ sub, name, surname, nick, email, role, image, iat, expired }`
- Expiry: `moment().add(3, 'days').unix()`
- Guard: `middlewares/authenticated.js` — reads `req.headers.authorization`, decodes and validates expiry, attaches payload to `req.user`

## File Uploads

| Domain | Upload Dir | Field name | Handler |
|--------|-----------|------------|---------|
| User avatar | `./uploads/users/` | `image` | `uploadImageMigrate` |
| Publication image | `./uploads/publications/` | `image` | `uploadImageMigrate` |

- Engine: `multer` (via `middlewares/upload.js`), max 2 MB
- Filename: original filename preserved (`file.originalname`)
- Legacy: `connect-multiparty` still present in user routes (kept for backward compat)
- Static serving: `GET /get-image-user/:imageFile` and `GET /get-image-pub/:imageFile`

## Key Patterns

- **Controllers call models directly** — no service/repository layer between controller and Mongoose.
- **Callback + Promise mixed style** — older handlers use Mongoose callbacks; newer ones use `async/await` + `pify`.
- **Pagination** — `mongoose-pagination` (`Model.paginate(page, itemsPerPage, callback)`), 10 items per page.
- **Follow graph queries** — `followUserIds()` and `followThisUser()` are async helpers used in controller functions.
- **Password never returned** — `user.password = undefined` before sending login response.
- **Role field** — hardcoded to `'ROLE_USER'` on registration; no admin enforcement visible in code.
- **CORS** — wildcard `Access-Control-Allow-Origin: *` set globally in `app.js`.

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | HTTP listen port |
| `MONGODB_URL` | `mongodb://localhost:27017/social` | MongoDB connection string |

## Feature Lifecycle (AI Reactive Framework)

```
flow/1-to_do/     ← Business spec generated by /rf_to_do
flow/2-wip/       ← Active implementation via /rf_wip + /rf_implement
flow/3-to_review/ ← Ready for review via /rf_review
flow/4-done/      ← Completed via /rf_done
```

Use `/rf_context` to regenerate context files from requirement docs.
Use `/rf_plan` to generate a prioritized implementation plan.
Use `/rf_summary` to see all features, dependencies, and issues.
