---
generated: 2026-04-27
sources:
  - ai_reactive_framework/context/requirements/context_rfc.md
  - ai_reactive_framework/context/1-features.md
  - ai_reactive_framework/context/2-dependencies.md
  - ai_reactive_framework/context/3-issues.md
---

═══════════════════════════════════════════════════════
  RF Implementation Plan
═══════════════════════════════════════════════════════

  Tech Stack:   Node.js 18 · Express.js · MongoDB→MySQL (Sequelize)
  Architecture: MVC · HTTP REST · controllers call ORM models directly

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 IMPLEMENTATION ORDER — MongoDB → MySQL Migration
  ────────────────────────────────────────────────────────────────────────────
  #  Feature                          Priority  Phase    Complexity  Blocker?
  ────────────────────────────────────────────────────────────────────────────
  1  mysql-connection-setup           P0        backlog  low         —
  2  user-model-mysql                 P0        backlog  medium      #1
  3  follow-model-mysql               P0        backlog  medium      #2
  4  publication-model-mysql          P0        backlog  medium      #2
  5  message-model-mysql              P0        backlog  medium      #2
  6  replace-pagination               P1        backlog  low         #3,#4,#5
  7  replace-bcrypt-nodejs            P0        backlog  low         I3
  8  fix-jwt-secret                   P0        backlog  trivial     I1
  9  add-dotenv                       P0        backlog  trivial     —
  10 data-migration-script            P2        backlog  high        #2–#5

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📐 FEATURE BREAKDOWN
  ────────────────────────────────────────────────────────────────────────────

  [#1] mysql-connection-setup  ·  P0  ·  backlog
  ──────────────────────────────────────────────────
  Objective:      Replace Mongoose/MongoDB bootstrap with Sequelize + MySQL connection
  Layers needed:  bootstrap (index.js) · config
  Files to create:
    - config/database.js          (Sequelize instance: dialect mysql, env-based credentials)
  Files to update:
    - index.js                    (remove mongoose.connect; import sequelize.authenticate + sync)
    - package.json                (add sequelize, mysql2; remove mongoose, mongoose-pagination)
    - .gitignore                  (ensure .env is ignored)
  Dependencies:   sequelize@^6, mysql2@^3, dotenv@^16
  Risks:          none — purely additive before models are swapped

  ──────────────────────────────────────────────────
  [#2] user-model-mysql  ·  P0  ·  backlog
  ──────────────────────────────────────────────────
  Objective:      Replace Mongoose User schema with Sequelize User model backed by MySQL table
  Layers needed:  model · controller (update queries)
  MySQL table — `users`:
    | Column    | Type         | Notes                   |
    |-----------|-------------|-------------------------|
    | id        | INT PK AUTO  | replaces Mongo _id       |
    | name      | VARCHAR(100) |                          |
    | surname   | VARCHAR(100) |                          |
    | nick      | VARCHAR(50)  | UNIQUE                   |
    | email     | VARCHAR(150) | UNIQUE                   |
    | password  | VARCHAR(255) | bcryptjs hash            |
    | role      | VARCHAR(20)  | default 'ROLE_USER'      |
    | image     | VARCHAR(255) | nullable                 |
    | createdAt | DATETIME     | Sequelize auto           |
    | updatedAt | DATETIME     | Sequelize auto           |
  Files to create:
    - models/user.js              (rewrite: Sequelize.define or class extends Model)
  Files to update:
    - controllers/user.js         (replace Mongoose API: findById→findByPk, find→findAll,
                                   findByIdAndUpdate→update+findByPk, paginate→manual limit/offset)
    - services/jwt.js             (sub: user.id instead of user._id)
    - middlewares/authenticated.js (sub: req.user.sub remains integer id)
  Dependencies:   sequelize@^6, mysql2@^3
  Risks:          I3 (bcrypt-nodejs) — fix concurrently; R5 (no validation)

  ──────────────────────────────────────────────────
  [#3] follow-model-mysql  ·  P0  ·  backlog
  ──────────────────────────────────────────────────
  Objective:      Replace Mongoose Follow schema with Sequelize model; user→followed as FK integers
  Layers needed:  model · controller (update queries)
  MySQL table — `follows`:
    | Column     | Type     | Notes                    |
    |------------|---------|--------------------------|
    | id         | INT PK   |                          |
    | userId     | INT FK   | → users.id               |
    | followedId | INT FK   | → users.id               |
    | createdAt  | DATETIME |                          |
    | updatedAt  | DATETIME |                          |
  Files to create:
    - models/follow.js            (rewrite: Sequelize model + belongsTo associations)
  Files to update:
    - controllers/follow.js       (replace Mongoose API with Sequelize findOne/create/destroy/findAll)
    - controllers/user.js         (followThisUser, followUserIds, getCountFollow — replace
                                   Follow.count()→Follow.count()/countDocuments equivalent:
                                   Follow.count({ where: { userId } }))
  Dependencies:   sequelize@^6
  Risks:          —

  ──────────────────────────────────────────────────
  [#4] publication-model-mysql  ·  P0  ·  backlog
  ──────────────────────────────────────────────────
  Objective:      Replace Mongoose Publication schema with Sequelize model
  Layers needed:  model · controller (update queries)
  MySQL table — `publications`:
    | Column    | Type         | Notes          |
    |-----------|-------------|----------------|
    | id        | INT PK AUTO  |                |
    | text      | TEXT         |                |
    | file      | VARCHAR(255) | nullable       |
    | userId    | INT FK       | → users.id     |
    | createdAt | DATETIME     | replaces string created_at |
    | updatedAt | DATETIME     |                |
  Files to create:
    - models/publication.js       (rewrite: Sequelize model + belongsTo User)
  Files to update:
    - controllers/publication.js  (replace Mongoose API with Sequelize; paginate→limit/offset)
    - controllers/user.js         (Publication.count({where:{userId}}) for counters)
  Dependencies:   sequelize@^6
  Risks:          —

  ──────────────────────────────────────────────────
  [#5] message-model-mysql  ·  P0  ·  backlog
  ──────────────────────────────────────────────────
  Objective:      Replace Mongoose Message schema with Sequelize model
  Layers needed:  model · controller (update queries)
  MySQL table — `messages`:
    | Column     | Type         | Notes               |
    |------------|-------------|---------------------|
    | id         | INT PK AUTO  |                     |
    | emitterId  | INT FK       | → users.id          |
    | receiverId | INT FK       | → users.id          |
    | text       | TEXT         |                     |
    | viewed     | BOOLEAN      | replaces String     |
    | createdAt  | DATETIME     | replaces string     |
    | updatedAt  | DATETIME     |                     |
  Files to create:
    - models/message.js           (rewrite: Sequelize model + two belongsTo User associations)
  Files to update:
    - controllers/message.js      (replace Mongoose API; fix viewed: String→Boolean)
  Dependencies:   sequelize@^6
  Risks:          —

  ──────────────────────────────────────────────────
  [#6] replace-pagination  ·  P1  ·  backlog
  ──────────────────────────────────────────────────
  Objective:      Remove mongoose-pagination; implement SQL-native limit/offset pagination in all list endpoints
  Layers needed:  controllers (user, follow, publication, message)
  Pagination pattern (Sequelize):
    const page = parseInt(req.params.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const { count, rows } = await Model.findAndCountAll({ limit, offset, order: [['id','ASC']] });
    res.status(200).send({ items: rows, total: count, pages: Math.ceil(count / limit) });
  Files to update:
    - controllers/user.js
    - controllers/follow.js
    - controllers/publication.js
    - controllers/message.js
    - package.json                (remove mongoose-pagination)
  Dependencies:   none (built into Sequelize)
  Risks:          —

  ──────────────────────────────────────────────────
  [#7] replace-bcrypt-nodejs  ·  P0  ·  backlog
  ──────────────────────────────────────────────────
  Objective:      Replace deprecated bcrypt-nodejs with bcryptjs; fix async race condition in saveUser
  Layers needed:  controller
  Files to update:
    - package.json                (remove bcrypt-nodejs, add bcryptjs@^2)
    - controllers/user.js         (import bcryptjs; refactor saveUser to async/await:
                                   const hash = await bcryptjs.hash(password, 10);
                                   user.password = hash;
                                   await user.save())
  Dependencies:   bcryptjs@^2
  Risks:          I3 — this IS the fix

  ──────────────────────────────────────────────────
  [#8] fix-jwt-secret  ·  P0  ·  backlog
  ──────────────────────────────────────────────────
  Objective:      Move hardcoded JWT secret to environment variable
  Layers needed:  services · middleware
  Files to update:
    - services/jwt.js             (const secret = process.env.JWT_SECRET)
    - middlewares/authenticated.js (const secret = process.env.JWT_SECRET)
    - .env                        (JWT_SECRET=<new_random_secret>  — add to .gitignore)
  Dependencies:   dotenv@^16 (see #9)
  Risks:          I1, R1 — this IS the fix

  ──────────────────────────────────────────────────
  [#9] add-dotenv  ·  P0  ·  backlog
  ──────────────────────────────────────────────────
  Objective:      Add dotenv to load environment variables from .env at bootstrap
  Layers needed:  bootstrap
  Files to update:
    - index.js                    (add require('dotenv').config() as first line)
    - package.json                (add dotenv@^16 to dependencies)
    - .gitignore                  (ensure .env is listed)
    - .env                        (create: PORT, MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD,
                                   MYSQL_DATABASE, JWT_SECRET)
  Dependencies:   dotenv@^16
  Risks:          —

  ──────────────────────────────────────────────────
  [#10] data-migration-script  ·  P2  ·  backlog
  ──────────────────────────────────────────────────
  Objective:      One-time script to export MongoDB collections and import into MySQL tables
  Layers needed:  standalone script (not part of the Express app)
  Files to create:
    - scripts/migrate-mongo-to-mysql.js  (connect both DBs; read MongoDB docs; insert into MySQL)
  Notes:
    - Map MongoDB ObjectId → auto-incremented INT (store old_id for reference during migration)
    - Migrate in order: users → follows → publications → messages (FK constraint order)
    - viewed field: String → Boolean (coerce "true"/"false" → true/false)
    - created_at field: String → DATETIME (parse with moment or Date)
  Dependencies:   mongoose@^5 (source), sequelize@^6 + mysql2@^3 (target)
  Risks:          R4 (Mongoose 5 deprecations during migration read — tolerable for a one-time script)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 DEPENDENCY READINESS
  ─────────────────────────────────────────────────────────────────────────
  Package / Service              Status        Required by
  ─────────────────────────────────────────────────────────────────────────
  sequelize@^6                   ✗ missing     #1,#2,#3,#4,#5,#6
  mysql2@^3                      ✗ missing     #1,#2,#3,#4,#5
  dotenv@^16                     ✗ missing     #8,#9
  bcryptjs@^2                    ✗ missing     #7
  pify (undeclared)              ✗ missing     controllers/user, publication (I2)
  express@^4.16.4                ✓ resolved    all routes
  jwt-simple@^0.5.5              ✓ resolved    auth middleware, login
  moment@^2.24.0                 ✓ resolved    JWT expiry, migration script
  multer@^1.4.5-lts.1            ✓ resolved    file upload handlers
  mongoose@^5.13.22              ✓ resolved    source DB for migration script (#10)
  mongoose-pagination@^1.0.0     ✓ resolved    (to be removed after #6)
  bcrypt-nodejs@0.0.3            ⚠ deprecated  (to be removed after #7 — I3)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠ BLOCKERS & RISKS
  ─────────────────────────────────────────────────────────────────────────
  [CRITICAL] I1 — Hardcoded JWT secret
    Affects: all authenticated endpoints
    Action:  Implement #8 + #9 (dotenv + secret env var) before any deployment

  [HIGH] I3 — Deprecated bcrypt-nodejs incompatible with Node 18+
    Affects: #2 (user-model-mysql), registration and login
    Action:  Implement #7 first; replace with bcryptjs@^2 and fix race condition

  [HIGH] I2 — pify not declared in package.json
    Affects: controllers/user.js, controllers/publication.js upload handlers
    Action:  npm install pify --save (or inline promisification) before running on clean install

  [HIGH] R5 — No input validation (NoSQL/SQL injection risk)
    Affects: all controllers — especially after MySQL migration (SQL injection surface)
    Action:  Add express-validator to all POST/PUT routes after models are migrated

  [MEDIUM] R4 — Mongoose 5.x deprecated APIs (Model.count)
    Affects: controllers/user.js getCountFollow() — used until #3,#4 complete
    Action:  Replace Follow.count() and Publication.count() with countDocuments() as part of #3/#4

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 NEXT STEPS
  ─────────────────────────────────────────────────────────────────────────
  1. /rf_to_do mysql-connection-setup   — generate spec; install sequelize, mysql2, dotenv
  2. /rf_to_do fix-jwt-secret           — harden auth before building new models
  3. /rf_to_do replace-bcrypt-nodejs    — unblock user model + fix race condition
  4. /rf_wip   mysql-connection-setup   — start active development on DB layer

═══════════════════════════════════════════════════════
