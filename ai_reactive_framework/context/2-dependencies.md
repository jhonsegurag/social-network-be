# Dependencies — social-network-be / JSP

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

### Planned Dependencies (JSP features)

| Package | Purpose | Feature |
|---------|---------|---------|
| `bcryptjs` | Replace deprecated `bcrypt-nodejs` | HU-JSP01/02 |
| `express-validator` / `joi` | Input validation and sanitization | All HU |
| `express-rate-limit` | Rate limiting for login/register | HU-JSP02 |
| `nodemailer` / SendGrid SDK | Email verification and notifications | HU-JSP01, HU-JSP02, HU-JSP05 |
| `@aws-sdk/client-s3` / `@google-cloud/storage` | Cloud object storage for uploads | HU-JSP03, HU-JSP07 |
| `passport` + `passport-google-oauth20` + `passport-linkedin-oauth2` | Social OAuth login | HU-JSP02 |
| `speakeasy` / `otplib` | 2FA token generation | HU-JSP02 |
| `multer-s3` | Stream uploads directly to S3 | HU-JSP03, HU-JSP07 |
| `uuid` | Unique filenames for uploads | HU-JSP03, HU-JSP07 |
| `pdf-lib` / `pdfkit` | PDF export of professional profile | HU-JSP03 |
| `ioredis` | Redis client for caching and session store | HU-JSP05 |
| `amqplib` | RabbitMQ client for async notification processing | HU-JSP05, HU-JSP06 |
| `@elastic/elasticsearch` | Elasticsearch client for advanced search | HU-JSP05 |
| `dotenv` | Load environment variables from `.env` file | All |

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

### Planned Route → Controller Mapping (JSP)

| Route File | Controller File | Description |
|-----------|----------------|-------------|
| `routes/profile.js` | `controllers/profile.js` | Professional profile CRUD (education, experience, skills) |
| `routes/job.js` | `controllers/job.js` | Job posting lifecycle for empresa users |
| `routes/application.js` | `controllers/application.js` | Job application submission and state management |
| `routes/recommendation.js` | `controllers/recommendation.js` | Personalized job recommendations |

### Controller → Model Mapping

| Controller | Models Used |
|-----------|-------------|
| `controllers/user.js` | `User`, `Follow`, `Publication` |
| `controllers/follow.js` | `Follow`, `User` |
| `controllers/publication.js` | `Publication`, `Follow` |
| `controllers/message.js` | `Message`, `User` |

### Planned Controller → Model Mapping (JSP)

| Controller | Models Used |
|-----------|-------------|
| `controllers/profile.js` | `Profile`, `User` |
| `controllers/job.js` | `Job`, `User` |
| `controllers/application.js` | `Application`, `Job`, `User` |
| `controllers/recommendation.js` | `Job`, `Profile`, `User` |

### Middleware Dependencies

| Middleware | Used By | Purpose |
|-----------|---------|---------|
| `middlewares/authenticated.js` | All protected routes | Decode JWT, populate `req.user`, reject expired/invalid tokens |
| `middlewares/upload.js` | `controllers/user.js`, `controllers/publication.js` | Build multer upload handler for a given directory and field name |

### Service Dependencies

| Service | Used By | Purpose |
|---------|---------|---------|
| `services/jwt.js` | `controllers/user.js` (login) | Create JWT token payload with 3-day expiry |

### Planned Service Dependencies (JSP)

| Service | Used By | Purpose |
|---------|---------|---------|
| `services/recommendation.js` | `controllers/recommendation.js` | Weighted profile-to-job matching algorithm |
| `services/email.js` | `controllers/user.js` | Email verification, notifications, weekly digest |
| `services/storage.js` | `controllers/profile.js`, `controllers/publication.js` | Storage adapter abstracting local disk vs S3/GCS |
| `services/search.js` | `controllers/recommendation.js`, `controllers/job.js` | Elasticsearch / MongoDB text index abstraction |

---

## Shared Infrastructure Dependencies

### Authentication Flow

JWT secret is **duplicated** in two files:
- `services/jwt.js` — token creation
- `middlewares/authenticated.js` — token validation

Both use `const secret = 'Secret_Key1-2-3.'`. Any secret rotation must update both files. **Must be moved to `process.env.JWT_SECRET` before any JSP feature ships.**

### File Upload Pattern (current)

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

## External Service Integrations (JSP)

| Service | Provider Options | Purpose | Feature |
|---------|-----------------|---------|---------|
| Transactional email | SendGrid, AWS SES | Verification links, notifications | HU-JSP01, HU-JSP02, HU-JSP05 |
| Cloud storage | AWS S3, Google Cloud Storage | Persistent file storage | HU-JSP03, HU-JSP07 |
| Image processing | Cloudinary, ImageKit | Resize and optimize uploads | HU-JSP03, HU-JSP07 |
| Geolocation | Google Maps API | Location autocomplete and validation | HU-JSP01, HU-JSP04 |
| Analytics | Google Analytics, Mixpanel | Platform usage metrics | All |
| Social OAuth | Google OAuth, LinkedIn API | Social login | HU-JSP02 |
| Identity verification | TBD | Company identity verification | HU-JSP01 |
| Job board APIs | TBD | Import external vacancies | HU-JSP04 |
| Sentiment analysis | TBD | Content moderation | HU-JSP07 |
| Search engine | Elasticsearch | Advanced job/profile search | HU-JSP05 |
| Cache / Queue | Redis + RabbitMQ | Performance + async notifications | HU-JSP05, HU-JSP06 |

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
- JSP recommendation engine requires a populated dataset to produce meaningful results — cold-start strategy needed
- Elasticsearch and Redis add operational overhead — evaluate managed services (AWS OpenSearch, Redis Cloud) to reduce DevOps burden
