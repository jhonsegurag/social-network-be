---
feature: user-registration-auth
phase: to_do
priority: P0
created: 2026-07-03
source: ai_reactive_framework/context/1-plan.md
---

# Business Specification — user-registration-auth

---

## 1. Objective

`user-registration-auth` implements the **shared authentication infrastructure** that underpins all JSP user registration flows. It extends the existing `User` Mongoose model with the fields needed to support dual user types (`profesional` / `empresa`), account lifecycle states (`pending_verification` → `active`), secure password hashing via `bcryptjs`, and email-based identity verification. It also creates the `services/email.js` utility and exposes the `POST /api/register` base endpoint, `GET /api/verify-email/:token`, and `POST /api/resend-verification`. The `user-registration-professional` and `user-registration-company` features build on top of this foundation — neither should be implemented until this spec is merged and tested.

---

## 2. Scope

| In scope | Out of scope |
|----------|-------------|
| User model schema extension (`userType`, `status`, `verificationToken`, `verificationExpiry`, `consentGiven`) | Professional-specific fields (`title`, `location`, `availability`, links) — see `user-registration-professional` |
| Password hashing migration from `bcrypt-nodejs` to `bcryptjs`; sequential async/await pattern | Company-specific fields (`razonSocial`, `nit`, `sector`, corporate email domain validation) — see `user-registration-company` |
| Verification token generation (crypto random, 64 hex chars) and 24h expiry | Social OAuth login (Google, LinkedIn) — deferred to `login` feature |
| `services/email.js` with `sendVerificationEmail()` and `sendRecoveryEmail()` | Two-factor authentication (2FA) |
| `POST /api/register` — shared base handler with type branching stub | Rate limiting on `/api/register` — implemented in `login` feature via `middlewares/rateLimiter.js` |
| `GET /api/verify-email/:token` — marks account `active` | Email service provider configuration (SendGrid / nodemailer SMTP) — requires env vars set by `add-dotenv` |
| `POST /api/resend-verification` — re-sends token if account still pending | File I/O and runtime execution of generated code |
| GDPR consent field (`consentGiven: Boolean, consentDate: Date`) on User model | Data export / deletion endpoints — separate compliance feature |
| Input validation via `express-validator` for shared fields (`email`, `password`, `userType`, `country`) | Admin user management UI |

---

## 3. Actors

| Actor | Description |
|-------|-------------|
| Visitor (unauthenticated) | Initiates registration; submits email, password, userType, and country |
| Email service (SendGrid / nodemailer) | Receives instruction to deliver verification email |
| Registered user (pending) | Clicks verification link or requests resend |
| `controllers/user.js` | Orchestrates validation, model creation, and email dispatch |
| `services/email.js` | Constructs and sends transactional emails |
| `models/user.js` | Persists extended schema fields |

---

## 4. User Stories

```
AS A visitor
I WANT TO register with my email, password, user type, and country
SO THAT I can create a JSP account and receive a verification email
```

### Story 1 — Successful registration creates pending account

**Given** a visitor submits `POST /api/register` with a valid email, a password meeting policy (≥8 chars, uppercase, lowercase, number), a valid `userType` (`profesional` or `empresa`), and `consentGiven: true`
**When** the controller validates all inputs, hashes the password with bcryptjs, generates a 64-char hex verification token with 24h expiry, saves the User document with `status: 'pending_verification'`, and calls `services/email.js`
**Then** the response is `201 Created` with `{ message: "Registration successful. Check your email to verify your account." }` and a verification email is dispatched to the provided address

### Story 2 — Duplicate email is rejected

**Given** a visitor submits `POST /api/register` with an email already present in the `users` collection
**When** the Mongoose unique index on `email` triggers a duplicate key error (code 11000)
**Then** the controller returns `409 Conflict` with `{ message: "Email is already registered.", error: "conflict_error", status: 409 }` and no new document is created

### Story 3 — Email verification activates account

**Given** a registered user (status `pending_verification`) clicks the link `GET /api/verify-email/:token` within 24 hours
**When** the controller looks up the user by `verificationToken`, checks `verificationExpiry > Date.now()`, sets `status: 'active'`, clears the token fields, and saves
**Then** the response is `200 OK` with `{ message: "Email verified. Your account is now active." }` and the user can proceed to login

### Story 4 — Expired token triggers resend

**Given** a registered user's verification link has expired (past 24h) and they submit `POST /api/resend-verification` with their email
**When** the controller finds the user in `pending_verification` state, generates a new token + expiry, saves, and calls `services/email.js`
**Then** the response is `200 OK` with `{ message: "Verification email resent." }` and a fresh link is delivered

---

## 5. Acceptance Criteria

- [ ] `POST /api/register` returns `201` with a confirmation message; no `password` or `verificationToken` is present in the response body
- [ ] Passwords are hashed with `bcryptjs` using `saltRounds: 10`; hashing is fully awaited before `user.save()` is called (sequential async — no race condition)
- [ ] Submitting a duplicate `email` returns `409 Conflict`; existing user document is unchanged
- [ ] Submitting `POST /api/register` without `email`, `password`, `userType`, or `consentGiven` returns `400 Bad Request` with a field-level error array from `express-validator`
- [ ] Submitting a `password` that fails policy (< 8 chars, no uppercase, no lowercase, no digit) returns `400 Bad Request` with a descriptive message per failing rule
- [ ] `GET /api/verify-email/:token` with a valid, non-expired token sets `user.status = 'active'`, clears `verificationToken` and `verificationExpiry`, and returns `200 OK`
- [ ] `GET /api/verify-email/:token` with an expired token returns `410 Gone`; account remains `pending_verification`
- [ ] `GET /api/verify-email/:token` with an unknown token returns `404 Not Found`
- [ ] `POST /api/resend-verification` for an already-`active` account returns `409 Conflict`
- [ ] The `consentGiven` field is stored as `true` on the User document; requests with `consentGiven: false` or missing are rejected with `400`

---

## 6. API Contract

### Endpoint 1 — Register

```
POST /api/register
Content-Type: application/json
```

#### Request

```json
{
  "userType": "profesional | empresa",
  "email": "user@example.com",
  "password": "SecurePass1",
  "country": "CO",
  "consentGiven": true
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `userType` | `string` | Yes | Must be `"profesional"` or `"empresa"` |
| `email` | `string` | Yes | Valid email format; unique in collection |
| `password` | `string` | Yes | ≥8 chars; ≥1 uppercase, lowercase, digit |
| `country` | `string` | Yes | ISO 3166-1 alpha-2 code (e.g. `"CO"`, `"US"`) |
| `consentGiven` | `boolean` | Yes | Must be `true` |

#### Response — 201 Created

```json
{
  "status": "success",
  "message": "Registration successful. Check your email to verify your account."
}
```

#### Response — Error

```json
{
  "message": "human-readable message",
  "error": "error_type_key",
  "status": 400
}
```

---

### Endpoint 2 — Verify Email

```
GET /api/verify-email/:token
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | `string` | Yes | 64-char hex token from verification email |

#### Response — 200 OK

```json
{
  "status": "success",
  "message": "Email verified. Your account is now active."
}
```

---

### Endpoint 3 — Resend Verification

```
POST /api/resend-verification
Content-Type: application/json
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | `string` | Yes | Must match an existing `pending_verification` account |

#### Response — 200 OK

```json
{
  "status": "success",
  "message": "Verification email resent."
}
```

---

## 7. Business Rules

| # | Rule | Rationale |
|---|------|-----------|
| BR-01 | Password must be hashed with `bcryptjs` (`saltRounds: 10`) and fully awaited before `user.save()` — no parallel callbacks | Previous `bcrypt-nodejs` callback pattern caused a race condition where `user.save()` could run before hashing completed (Known Limitation #7) |
| BR-02 | `password`, `verificationToken`, and `verificationExpiry` must never appear in any API response body | These are internal security fields; exposure via response would allow token forgery and credential extraction |
| BR-03 | Verification tokens must be generated with `crypto.randomBytes(32).toString('hex')` (64 hex chars) and expire exactly 24 hours after issuance | Predictable tokens or missing expiry allow account takeover; 24h is sufficient for most users while limiting the attack window |
| BR-04 | `consentGiven` must be explicitly `true` in the request; the system must store `consentGiven` and `consentDate` on the User document | GDPR/CCPA compliance (Risk R8) requires proof of informed consent at the moment of registration |
| BR-05 | `userType` must be persisted as `'profesional'` or `'empresa'` and must never be changed after creation | User type determines which downstream features are accessible; mutation after creation would bypass access guards in `user-registration-professional` and `user-registration-company` |
| BR-06 | A user with `status: 'active'` who requests resend-verification must receive `409 Conflict` — no new token is generated | Prevents token churn and potential DoS against the email service |

---

## 8. State Transitions

Account lifecycle managed by this feature:

```
[none] ──[POST /api/register]──► pending_verification ──[GET /api/verify-email/:token]──► active
                                         │
                                  [POST /api/resend-verification]
                                         │
                                  pending_verification (new token)
```

| From | Trigger | To | Guard condition |
|------|---------|-----|----------------|
| *(not exist)* | `POST /api/register` | `pending_verification` | Email unique; password valid; consentGiven true |
| `pending_verification` | `GET /api/verify-email/:token` | `active` | Token matches; `verificationExpiry > Date.now()` |
| `pending_verification` | `GET /api/verify-email/:token` | `pending_verification` (unchanged) | Token expired → return 410 |
| `pending_verification` | `POST /api/resend-verification` | `pending_verification` (new token) | Account must be in pending state |
| `active` | `POST /api/resend-verification` | `active` (unchanged) | Already active → return 409 |

---

## 9. Error Cases

| Scenario | Error Type | HTTP Status | Message |
|----------|-----------|-------------|---------|
| Missing required field (`email`, `password`, `userType`, `consentGiven`) | `bad_request_error` | 400 | `"Validation failed: <field> is required."` |
| Password fails policy | `bad_request_error` | 400 | `"Password must be at least 8 characters and include uppercase, lowercase, and a number."` |
| `consentGiven` is false or absent | `bad_request_error` | 400 | `"You must accept the terms and conditions to register."` |
| Invalid `userType` value | `bad_request_error` | 400 | `"userType must be 'profesional' or 'empresa'."` |
| Email already registered | `conflict_error` | 409 | `"Email is already registered."` |
| Verification token not found | `not_found_error` | 404 | `"Verification token not found."` |
| Verification token expired | `gone_error` | 410 | `"Verification link has expired. Please request a new one."` |
| Resend for already-active account | `conflict_error` | 409 | `"Account is already verified."` |
| Email dispatch fails | `failed_dependency_error` | 424 | `"Registration saved but verification email could not be sent. Please request a resend."` |
| Unexpected database or server error | `internal_server_error` | 500 | `"An unexpected error occurred. Please try again later."` |

---

## 10. Non-Functional Requirements

| Attribute | Target |
|-----------|--------|
| Latency (p99) | < 500 ms for `POST /api/register` (bcrypt hash is the bottleneck at ~100ms for saltRounds 10) |
| Latency (p99) | < 200 ms for `GET /api/verify-email/:token` (single indexed lookup) |
| Availability | 99.9% |
| Throughput | Sufficient for registration bursts; email dispatch must be non-blocking (fire-and-forget with error logging) |
| Data sensitivity | PII — `email`, `country`, `name` fields. Must not be logged in plaintext. `password` must never be logged. |
| Security | `bcryptjs` saltRounds: 10; token generated via `crypto.randomBytes` (CSPRNG); no token reuse after verification |

---

## 11. Dependencies

| System | Type | Purpose |
|--------|------|---------|
| `models/user.js` | Internal — Mongoose model | Extended schema: `userType`, `status`, `verificationToken`, `verificationExpiry`, `consentGiven`, `consentDate` |
| `services/email.js` | Internal — new service | `sendVerificationEmail(to, token)`, `sendRecoveryEmail(to, token)` |
| `bcryptjs` | npm package | Sequential async password hashing — replaces `bcrypt-nodejs` (resolved by `replace-bcrypt-nodejs` to_review item) |
| `express-validator` | npm package | Request body validation for `email`, `password`, `userType`, `country`, `consentGiven` |
| `dotenv` + `process.env` | Environment | `JWT_SECRET`, `EMAIL_HOST`/`SENDGRID_API_KEY`, `VERIFICATION_BASE_URL` (resolved by `add-dotenv` to_review item) |
| `nodemailer` or `@sendgrid/mail` | npm package | SMTP / API transport for outbound email |
| `crypto` (Node.js built-in) | stdlib | `crypto.randomBytes(32).toString('hex')` for token generation |
| `ai_reactive_framework/context/0-context.md` | Knowledge base | Tech stack, auth conventions, environment variable defaults |
| `ai_reactive_framework/1-business_layer/templates/business_rules_template.md` | Knowledge base | Spec structure and section definitions |
| `ai_reactive_framework/context/requirements/job-social-platform_rfc.md` | Knowledge base | HU-JSP01 acceptance criteria, password policy, verification flow |

---

## 12. Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| OQ-01 | Should `POST /api/register` immediately return `201` even if the email dispatch fails (fire-and-forget), or should email delivery failure block the response with `424`? | | |
| OQ-02 | Which email provider will be used first — nodemailer (SMTP) for local dev + SendGrid for prod, or SendGrid exclusively? This determines the `services/email.js` adapter interface. | | |