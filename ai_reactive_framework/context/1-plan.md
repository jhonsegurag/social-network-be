# Implementation Plan — JSP (Job Social Platform)

## Knowledge Base Coverage

| Domain | Files |
|--------|-------|
| Architecture | `ai_reactive_framework/2-core_layer/architecture_specification/patterns_design_catalog.md`, `architecture_patterns_catalog.md` |
| Business templates | `ai_reactive_framework/1-business_layer/templates/business_rules_template.md`, `plan_template.md`, `dependencies_template.md`, `issues_template.md` |
| Code evaluation | `ai_reactive_framework/4-assisted_code_layer/evaluator/backend_app.md` |
| Testing | `ai_reactive_framework/4-assisted_code_layer/testing/testing_template.md` |
| Requirements | `ai_reactive_framework/context/requirements/context_rfc.md`, `job-social-platform_rfc.md` |

## Recommended Features — 7 Total

---

### P0 — Core Authentication Loop

#### HU-JSP01-A: User Registration (professional / Empresa)

**Description:** Dual-track registration for individual professionals and companies. Professionals provide personal info; companies provide corporate identity (NIT/RUC, sector). Both tracks send email verification.

**Inputs:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `role` | enum | Yes | `professional` \| `company` |
| `email` | string | Yes | Must be unique; corporate domain for empresa |
| `password` | string | Yes | Min 8 chars, uppercase, lowercase, numbers |

**Service path:** `controllers/auth.js` → `models/auth.js`

**Complexity:** Medium — dual schema, email service integration, verification token storage

---

#### HU-JSP01-B: User Registration (Professional)

**Description:** Dual-track registration for individual professionals. Professionals provide personal info. Both tracks send email verification.

**Inputs:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `role` | enum | Yes | `professional` \| `company` |
| `email` | string | Yes | Must be unique; corporate domain for empresa |
| `password` | string | Yes | Min 8 chars, uppercase, lowercase, numbers |
| `first_name` | string | Yes | Depends on userType |
| `last_name` | string | Yes | Depends on userType |
| `country` | string | Yes | Used for validation |

**Service path:** `controllers/professional.js` → `models/professional.js`

**Complexity:** Medium — dual schema, email service integration, verification token storage

---

#### HU-JSP01-C: User Registration (Company)

**Description:** Dual-track registration for individual professionals and companies. Professionals provide personal info; companies provide corporate identity (NIT/RUC, sector). Both tracks send email verification.

**Inputs:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `role` | enum | Yes | `professional` \| `company` |
| `email` | string | Yes | Must be unique; corporate domain for empresa |
| `password` | string | Yes | Min 8 chars, uppercase, lowercase, numbers |
| `name`| string | Yes | Depends on userType |
| `country` | string | Yes | Used for NIT/RUC validation |
| `nit` | string | empresa only | Unique per system |

**Service path:** `controllers/company.js` → `models/company.js`

**Complexity:** Medium — dual schema, email service integration, verification token storage

---

#### HU-JSP02: Login

**Description:** Authenticate by email + password. Return JWT. Enforce account state, lockout policy, and inactivity rules.

**Inputs:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `email` | string | Yes | Must match registered account |
| `password` | string | Yes | bcrypt comparison |
| `rememberme` | boolean | No | Extends token to 30 days |

**Service path:** `controllers/user.js` → `services/jwt.js`

**Complexity:** Low-Medium — extends existing login; adds lockout counter, token refresh, social OAuth hooks

---

### P1 — High Value Features

#### HU-JSP03: Professional Profile (Historial Laboral)

**Description:** Professionals build a rich profile: personal info, multiple education records, work experience entries (with auto-calculated seniority level), skills with endorsements, and privacy controls.

**Inputs:**

| Section | Key Fields |
|---------|-----------|
| Personal | title, location, availability, summary (≤500 chars), links, privacy |
| Education | institution, degree, level, start/end dates, status, certificates |
| Experience | company, role, dates, functions, achievements, technologies |
| Skills | category (technical/soft/language/cert), level, endorsers |

**Service path:** New `controllers/profile.js` → `models/profile.js` (or extend `models/user.js`)

**Complexity:** High — multiple sub-resources (education[], experience[], skills[]), file attachments, seniority calculation, PDF export

---

#### HU-JSP04: Create Job Posting (Convocatoria)

**Description:** Companies create detailed job postings with salary ranges, requirements, and privacy options. Posts move through draft → published lifecycle with post-publish management tools.

**Inputs:**

| Field | Type | Required |
|-------|------|----------|
| `title` | string (≤100) | Yes |
| `description` | string (≤2000) | Yes |
| `location` | string / "remote" | Yes |
| `modality` | enum | Yes |
| `contractType` | enum | Yes |
| `level` | enum | Yes |
| `salaryMin/Max` | number | No |
| `closingDate` | date | No |
| `status` | enum | — |

**Service path:** New `controllers/job.js` → `models/job.js`

**Complexity:** Medium — CRUD + lifecycle state machine + statistics counters

---

#### HU-JSP06: Apply to Job (Ofertar a Convocatoria)

**Description:** Professionals apply to active postings. Applications move through a tracked state machine. Duplicate prevention, daily limits, and recruiter messaging are included.

**Inputs:**

| Field | Type | Required |
|-------|------|----------|
| `jobId` | ObjectId | Yes |
| `coverLetter` | string | Conditional |
| `cvFile` | file | Optional |
| `answers` | object[] | Conditional |

**Service path:** New `controllers/application.js` → `models/application.js`

**Complexity:** Medium-High — state machine, duplicate detection, notification hooks, analytics counters

---

### P2 — Reduces Common Friction

#### HU-JSP05: Job Recommendations

**Description:** Surfaces personalized job recommendations ranked by a weighted compatibility score (skills 40%, experience 30%, location/modality 15%, salary 10%, culture 5%). Includes feedback loop and notifications.

**Inputs:** Derived from the authenticated user's profile (no direct request body)

| Config | Notes |
|--------|-------|
| `minSalary` | filter preference |
| `location` | filter preference |
| `modality` | filter preference |
| `excludedCompanies` | filter preference |

**Service path:** New `services/recommendation.js` → queries `models/job.js` + `models/profile.js`

**Complexity:** Very High — matching algorithm, ML feedback loop, notification system, caching layer

---

#### HU-JSP07: Create Publication

**Description:** Professionals and companies post content (text, images, articles, job shares). Includes rich editing, audience targeting, hashtags, @mentions, reactions, nested comments, and content analytics.

**Inputs:**

| Field | Type | Required |
|-------|------|----------|
| `text` | string (rich) | Yes (if no images) |
| `images` | file[] (≤10, ≤10MB each) | No |
| `audience` | enum | Yes |
| `hashtags` | string[] | No |
| `mentions` | userId[] | No |
| `scheduledAt` | datetime | No |

**Service path:** `controllers/publication.js` (extend) → `models/publication.js` (extend)

**Complexity:** High — rich content, multi-image upload, reactions, nested comments, scheduling, analytics

---

## Implementation Order

### Phase 1 — Foundation (run in parallel)
- HU-JSP01: User Registration (dual type, email verification)
- HU-JSP02: Login (lockout, token refresh, OAuth hooks)

### Phase 2 — Core Data (run in parallel after Phase 1)
- HU-JSP03: Professional Profile
- HU-JSP04: Create Job Posting

### Phase 3 — Interaction Layer (run in parallel after Phase 2)
- HU-JSP06: Apply to Job
- HU-JSP07: Create Publication

### Phase 4 — Intelligence (requires Phase 2 + 3 data)
- HU-JSP05: Job Recommendations

---

## Complexity Summary

| Feature | Priority | Complexity | Key Concerns |
|---------|----------|-----------|--------------|
| HU-JSP01 User Registration | P0 | Medium | Dual schema, email verification, NIT validation |
| HU-JSP02 Login | P0 | Low-Medium | Lockout, token refresh, OAuth |
| HU-JSP03 Professional Profile | P1 | High | Sub-resources, file attachments, seniority calc |
| HU-JSP04 Job Posting | P1 | Medium | Lifecycle state, statistics |
| HU-JSP06 Apply to Job | P1 | Medium-High | State machine, duplicate guard, notifications |
| HU-JSP07 Create Publication | P2 | High | Multi-image, reactions, scheduling, analytics |
| HU-JSP05 Job Recommendations | P2 | Very High | Matching algorithm, ML feedback, caching |

---

## Key Architectural Decisions

- **User type discrimination:** Add `userType: { type: String, enum: ['professional', 'empresa'] }` to the User model. Empresa-specific fields (`razonSocial`, `nit`, `sector`) stored in the same document or a linked `CompanyProfile` document.
- **Profile as separate model:** Extend the User model with embedded arrays OR create a `Profile` model to avoid bloating the auth User document. Prefer separate model for cleaner separation.
- **Application state machine:** Store `status` as an enum on `Application` model; state transitions validated in controller before update.
- **JWT secret via env:** Before implementing HU-JSP02 enhancements, move `'Secret_Key1-2-3.'` to `process.env.JWT_SECRET` in both `services/jwt.js` and `middlewares/authenticated.js`.
- **File storage migration:** New uploads (profile photos ≥ JSP) should target S3/GCS rather than local disk. Use a storage adapter to keep controllers agnostic of the target.
- **Recommendation engine decoupling:** Implement as a separate service (`services/recommendation.js`) to enable future extraction into a microservice without touching controller code.
- **Search (Elasticsearch):** Required for advanced job/profile search (HU-JSP05 filters). Defer Elasticsearch integration until Phase 4; implement MongoDB `$text` indexes as a stepping stone.

---

## Critical Reference Files

| File | Purpose |
|------|---------|
| `controllers/user.js` | Existing auth — base for HU-JSP01/02 extensions |
| `middlewares/authenticated.js` | JWT guard — must be updated with env secret |
| `services/jwt.js` | Token creation — must be updated with env secret |
| `models/user.js` | Base user schema — extend with `userType`, company fields |
| `middlewares/upload.js` | Upload factory — swap destination for S3 adapter in JSP |
| `ai_reactive_framework/context/requirements/job-social-platform_rfc.md` | Full JSP functional requirements |
| `ai_reactive_framework/context/requirements/context_rfc.md` | Current architecture specification |
