---
generated: 2026-07-03
sources:
  - ai_reactive_framework/context/requirements/
  - ai_reactive_framework/context/1-features.md
  - ai_reactive_framework/context/2-dependencies.md
  - ai_reactive_framework/context/3-issues.md
---

═══════════════════════════════════════════════════════
  RF Implementation Plan
═══════════════════════════════════════════════════════

  Tech Stack:   Node.js 18 · Express ^4.16.4 · MongoDB (Mongoose 5)
  Architecture: MVC monolith — routes → middleware → controllers → models → MongoDB

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 IMPLEMENTATION ORDER
  ─────────────────────────────────────────────────────────────────────────────────
  #   Feature                       Priority  Phase        Complexity  Blocker?
  ─────────────────────────────────────────────────────────────────────────────────
  1   mysql-connection-setup         P0        to_review    medium      —
  2   fix-jwt-secret                 P0        to_review    low         —
  3   add-dotenv                     P0        to_review    low         —
  4   replace-bcrypt-nodejs          P0        to_review    low         —
  5   user-model-mysql               P0        to_review    medium      —
  6   follow-model-mysql             P0        to_review    medium      —
  7   publication-model-mysql        P0        to_review    medium      —
  8   message-model-mysql            P0        to_review    medium      —
  9   replace-pagination             P1        to_review    medium      —
  10  data-migration-script          P2        to_review    high        —
  11  HU-JSP01 user-registration-auth     P0        backlog      medium      I1 I3 I5 (resolving via #2–4)
  12  HU-JSP01 user-registration-professional     P0        backlog      medium      I1 I3 I5 (resolving via #2–4)
  13  HU-JSP01 user-registration-company     P0        backlog      medium      I1 I3 I5 (resolving via #2–4)
  14  HU-JSP02 login                 P0        backlog      medium      I1 I3 I5 (resolving via #2–4)
  15  HU-JSP03 professional-profile  P1        backlog      high        needs #11
  16  HU-JSP04 job-posting           P1        backlog      medium      needs #11
  17  HU-JSP06 apply-to-job          P1        backlog      medium-high needs #14
  18  HU-JSP07 create-publication    P2        backlog      high        needs #11
  19  HU-JSP05 job-recommendations   P2        backlog      very-high   needs #13 #14, R6

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📐 FEATURE BREAKDOWN
  ─────────────────────────────────────────────────────────────────────────────────

  [#1] mysql-connection-setup  ·  P0  ·  to_review
  ───────────────────────────────────────────────────
  Objective:    Establish MySQL database connection alongside MongoDB for the migration path
  Phase note:   Already implemented — pending review and merge

  [#2] fix-jwt-secret  ·  P0  ·  to_review
  ───────────────────────────────────────────
  Objective:    Move hardcoded JWT secret to process.env.JWT_SECRET in services/jwt.js and middlewares/authenticated.js
  Phase note:   Already implemented — pending review and merge

  [#3] add-dotenv  ·  P0  ·  to_review
  ───────────────────────────────────────
  Objective:    Add dotenv support so all process.env config is loaded from a .env file
  Phase note:   Already implemented — pending review and merge

  [#4] replace-bcrypt-nodejs  ·  P0  ·  to_review
  ─────────────────────────────────────────────────
  Objective:    Replace unmaintained bcrypt-nodejs with bcryptjs for Node.js 18 compatibility
  Phase note:   Already implemented — pending review and merge

  [#5–8] *-model-mysql  ·  P0  ·  to_review
  ────────────────────────────────────────────
  Objective:    Define Sequelize/MySQL models for User, Follow, Publication, Message (parallel migration track)
  Phase note:   All already implemented — pending review and merge

  [#9] replace-pagination  ·  P1  ·  to_review
  ───────────────────────────────────────────────
  Objective:    Replace mongoose-pagination (incompatible with Mongoose 7+) with countDocuments + skip/limit
  Phase note:   Already implemented — pending review and merge

  [#10] data-migration-script  ·  P2  ·  to_review
  ──────────────────────────────────────────────────
  Objective:    Script to migrate existing MongoDB data to MySQL for the dual-DB migration path
  Phase note:   Already implemented — pending review and merge

  ─────────────────────────────────────────────────────────────────────────────────

  [#11] HU-JSP01 user-registration  ·  P0  ·  backlog
  ──────────────────────────────────────────────────────
  Objective:      Dual-track registration for professional and Empresa with email verification and password policy
  Layers needed:  model → service → controller → route
  Files to update:
    - models/user.js             (add: userType, status, razonSocial, nit, country,
                                        verificationToken, verificationExpiry,
                                        loginAttempts, lockoutUntil)
    - controllers/user.js        (extend saveUser: dual-type branching, validation,
                                        email dispatch, account status management)
    - routes/user.js             (add: GET /verify-email/:token, POST /resend-verification)
  Files to create:
    - services/email.js          (sendVerificationEmail, sendRecoveryEmail)
  Dependencies:   bcryptjs (resolving via #4), express-validator, nodemailer or @sendgrid/mail, dotenv (resolving via #3)
  Risks:          I1 (jwt secret — resolving via #2), I3 (bcrypt — resolving via #4),
                  I5 (no .env — resolving via #3), R5 (no input validation), R8 (GDPR — add consent field)

  [#12] HU-JSP02 login  ·  P0  ·  backlog
  ──────────────────────────────────────────
  Objective:      Secure login with lockout policy, configurable JWT, refresh tokens, optional OAuth, and inactivity logout
  Layers needed:  service → middleware → controller → route
  Files to update:
    - controllers/user.js        (extend loginUser: lockout counter check, remember-me flag,
                                        refresh token issuance)
    - services/jwt.js            (configurable token lifetime, refresh token generation and rotation)
    - middlewares/authenticated.js (support token invalidation / refresh check)
    - routes/user.js             (add: POST /refresh-token, POST /logout,
                                        POST /forgot-password, POST /reset-password/:token)
  Files to create:
    - middlewares/rateLimiter.js (express-rate-limit config for /login and /register)
  Dependencies:   express-rate-limit, dotenv (resolving via #3), bcryptjs (resolving via #4)
  Risks:          I1 (hardcoded secret — resolving via #2), R5 (no input validation)

  [#13] HU-JSP03 professional-profile  ·  P1  ·  backlog
  ──────────────────────────────────────────────────────────
  Objective:      Professionals build rich profiles with education, work experience, skills, privacy controls, and PDF export
  Layers needed:  model → service → controller → route
  Files to create:
    - models/profile.js          (user ref, personal info, education[], experience[], skills[],
                                        privacy enum, completenessScore)
    - controllers/profile.js     (getProfile, updateProfile, addEducation, removeEducation,
                                        addExperience, removeExperience, addSkill, removeSkill,
                                        exportProfilePDF, getCompletenessScore)
    - routes/profile.js          (GET/PUT /profile/:userId,
                                        POST/DELETE /profile/education/:id,
                                        POST/DELETE /profile/experience/:id,
                                        POST/DELETE /profile/skill/:id,
                                        GET /profile/:userId/pdf)
    - services/storage.js        (adapter: local disk → S3/GCS, UUID-based filenames,
                                        shared by #13 and #16)
  Files to update:
    - app.js                     (mount routes/profile.js)
    - middlewares/upload.js      (wire storage adapter; raise limit to 10 MB for certificates)
  Dependencies:   uuid, multer-s3, @aws-sdk/client-s3 or @google-cloud/storage, pdf-lib or pdfkit
  Risks:          R2 (local disk — requires cloud migration via services/storage.js), needs #11 merged

  [#14] HU-JSP04 job-posting  ·  P1  ·  backlog
  ────────────────────────────────────────────────
  Objective:      Empresa users create and manage job postings through a draft → published lifecycle
  Layers needed:  model → controller → route
  Files to create:
    - models/job.js              (title, department, location, modality, contractType, level,
                                        description, requirements, salaryMin, salaryMax, benefits,
                                        status enum[draft,published,closed], closingDate,
                                        maxApplications, user ref, viewCount, applicationCount)
    - controllers/job.js         (saveJob, getJob, getJobs, updateJob, deleteJob, closeJob,
                                        getJobStats — empresa-only guards via req.user.userType)
    - routes/job.js              (POST /job, GET /jobs/:page?, GET /job/:id,
                                        PUT /job/:id, DELETE /job/:id, GET /job/:id/stats)
  Files to update:
    - app.js                     (mount routes/job.js)
  Dependencies:   express-validator (title ≤100 chars, description ≤2000 chars constraints)
  Risks:          needs #11 merged; R5 (no input validation)

  [#15] HU-JSP06 apply-to-job  ·  P1  ·  backlog
  ──────────────────────────────────────────────────
  Objective:      Professionals apply to active job postings; applications tracked through a 6-state machine
  Layers needed:  model → controller → route
  Files to create:
    - models/application.js      (job ref, applicant ref, status enum[enviada, en_revision,
                                        preseleccionado, entrevista, rechazada, contratado],
                                        coverLetter, cvFile, answers[], appliedAt, updatedAt)
    - controllers/application.js (saveApplication: duplicate guard + daily limit check,
                                        updateApplicationStatus: empresa-only,
                                        getApplicationsByJob, getMyApplications, withdrawApplication)
    - routes/application.js      (POST /application, GET /applications/job/:jobId,
                                        GET /my-applications/:page?, PUT /application/:id/status,
                                        DELETE /application/:id)
  Files to update:
    - app.js                     (mount routes/application.js)
  Dependencies:   amqplib (async notifications on status change — Phase 2; use sync email in Phase 1)
  Risks:          needs #14 merged; R5 (no input validation)

  [#16] HU-JSP07 create-publication  ·  P2  ·  backlog
  ────────────────────────────────────────────────────────
  Objective:      Rich content publishing with multi-image support, reactions, nested comments, hashtags, @mentions, and scheduling
  Layers needed:  model → service → controller → route
  Files to update:
    - models/publication.js      (extend: images[], reactions[], comments[{user,text,replies[]}],
                                        hashtags[], mentions[], audience enum, scheduledAt,
                                        editedAt, bookmarks[])
    - controllers/publication.js (extend: multi-image upload via storage adapter, addReaction,
                                        addComment, replyComment, repost, bookmark, getHashtagFeed)
    - routes/publication.js      (add: POST /publication/:id/reaction,
                                        POST /publication/:id/comment,
                                        POST /publication/:id/repost,
                                        POST /publication/:id/bookmark,
                                        GET /publications/hashtag/:tag)
  Files to create (if not done in #13):
    - services/storage.js        (shared adapter — create here if #13 not yet merged)
  Dependencies:   uuid, multer-s3, @aws-sdk/client-s3 (shared with #13)
  Risks:          needs #11 merged; R2 (file storage — resolved via services/storage.js from #13)

  [#17] HU-JSP05 job-recommendations  ·  P2  ·  backlog
  ────────────────────────────────────────────────────────
  Objective:      Weighted matching engine surfacing ranked job recommendations; skills 40%, experience 30%, location 15%, salary 10%, culture 5%
  Layers needed:  service → controller → route
  Files to create:
    - services/recommendation.js  (computeScore(profile, job): deterministic weighted scoring;
                                         rankJobs(userId): fetch active jobs, score, sort, cache in Redis)
    - services/search.js           (MongoDB $text index abstraction; Elasticsearch adapter for Phase 2)
    - controllers/recommendation.js (getRecommendations, submitFeedback, getSavedOffers)
    - routes/recommendation.js     (GET /recommendations/:page?,
                                         POST /recommendation/:jobId/feedback,
                                         POST /recommendation/:jobId/save)
  Files to update:
    - app.js                       (mount routes/recommendation.js)
  Dependencies:   ioredis (result caching), @elastic/elasticsearch (Phase 2), amqplib (push notifications)
  Risks:          R6 (cold-start — rule-based scoring first; ML deferred to Phase 2),
                  R7 (keep as in-process service; do not extract prematurely),
                  needs #13 and #14 merged to have profile + job data

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 DEPENDENCY READINESS
  ─────────────────────────────────────────────────────────────────────────────────
  Package / Service                    Status               Required by
  ─────────────────────────────────────────────────────────────────────────────────
  express                              ✓ resolved           all
  mongoose                             ✓ resolved           all (MongoDB models)
  jwt-simple                           ✓ resolved           #11 #12
  moment                               ✓ resolved           #11 #12
  multer                               ✓ resolved           #13 #16
  body-parser                          ✓ resolved           all
  bcryptjs                             ⏳ to_review (#4)    #11 #12
  dotenv                               ⏳ to_review (#3)    #11 #12 and all JSP features
  pify                                 ✗ undeclared         #13 #16 (upload handlers — add to package.json)
  express-validator                    ✗ missing            #11 #12 #13 #14 #15 #16
  express-rate-limit                   ✗ missing            #12
  nodemailer / @sendgrid/mail          ✗ missing            #11 #12 #17
  uuid                                 ✗ missing            #13 #16
  multer-s3                            ✗ missing            #13 #16
  @aws-sdk/client-s3                   ✗ missing            #13 #16
  pdf-lib / pdfkit                     ✗ missing            #13
  passport + passport-google-oauth20   ✗ missing            #12 (OAuth — Phase 2 only)
  ioredis                              ✗ missing            #17
  amqplib                              ✗ missing            #15 #17 (Phase 2)
  @elastic/elasticsearch               ✗ missing            #17 (Phase 2)
  Transactional email service          ✗ not configured     #11 #12 #17
  AWS S3 / GCS bucket                  ✗ not configured     #13 #16

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠ BLOCKERS & RISKS
  ─────────────────────────────────────────────────────────────────────────────────
  [CRITICAL] I1 — Hardcoded JWT secret
    Affects: #11 #12 and all authenticated JSP routes
    Action:  Merge fix-jwt-secret (to_review #2) before starting #11

  [HIGH] I3 — Deprecated bcrypt-nodejs
    Affects: #11 #12 (registration and login)
    Action:  Merge replace-bcrypt-nodejs (to_review #4) before starting #11

  [HIGH] I5 — No .env support
    Affects: All JSP features (email keys, storage keys, JWT secret)
    Action:  Merge add-dotenv (to_review #3) before starting any JSP feature

  [HIGH] R5 — No input validation
    Affects: #11 #12 #13 #14 #15 #16 (NoSQL injection risk)
    Action:  Install express-validator; add validation middleware to every new route

  [HIGH] R2 — Local disk file storage
    Affects: #13 (profile photos, certificates), #16 (publication images)
    Action:  Implement services/storage.js with S3 adapter in #13; configure bucket before deploy

  [HIGH] R8 — GDPR / CCPA not implemented
    Affects: #11 (collects PII at registration)
    Action:  Add consent field to User model in #11; plan data export + deletion endpoints

  [MEDIUM] R6 — Recommendation engine cold-start
    Affects: #17
    Action:  Implement deterministic weighted scoring in Phase 1; defer ML to Phase 2

  [MEDIUM] R7 — RFC calls for microservices vs current monolith
    Affects: #17 (recommendation service) — premature extraction risk
    Action:  Keep services/recommendation.js as in-process module; extract only when throughput demands it

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 NEXT STEPS
  ─────────────────────────────────────────────────────────────────────────────────
  1. /rf_done fix-jwt-secret        — close the 10 to_review items (unblocks all JSP features)
  2. /rf_to_do user-registration    — generate business spec for HU-JSP01 (first JSP feature)
  3. npm install express-validator dotenv nodemailer uuid pify — install first-wave JSP deps
  4. /rf_wip user-registration      — begin active implementation after spec is ready

═══════════════════════════════════════════════════════
