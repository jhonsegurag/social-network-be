# Backend App — Code Evaluation Guide

> Checklist and criteria for evaluating AI-generated or human-written backend code before merging. Use this as a PR review guide or a self-review checklist.

---

## 1. Architecture Compliance

- [ ] Code follows the POD layer structure (see `reference_architecture_template.mdc`)
- [ ] No cross-layer imports (e.g., handler importing `platform/repository` directly)
- [ ] Compile-time interface guard present on every concrete implementation
- [ ] New feature added all required files (domain, ports, usecase, orchestrator, repository, handler, DI)
- [ ] `dependencies/model.go` updated with new fields

---

## 2. Error Handling

- [ ] Repository errors use `repoerr.NotFound` / `repoerr.InternalServer` — not raw `errors.New`
- [ ] UseCase translates repo errors via `ucerr.FromRepositoryError`
- [ ] Handler calls `HandleError(w, err)` — no raw `http.Error` calls
- [ ] No error is silently swallowed (`_, err := ...` is a red flag)
- [ ] Error responses never expose internal details (stack traces, SQL messages, URLs)

---

## 3. Security

- [ ] No hardcoded secrets, tokens, or credentials anywhere in the code
- [ ] All user input validated with `validator.Struct()` at handler boundary
- [ ] No user-controlled input passed to `http.Get`, `http.Post`, or URL construction
- [ ] No raw SQL with string concatenation
- [ ] No PII in log statements
- [ ] No global mutable state modified from handlers or goroutines
- [ ] No custom `Content-Security-Policy`, `CORS`, or `Strict-Transport-Security` headers set

---

## 4. Context Propagation

- [ ] `ctx context.Context` is the first parameter in all I/O functions
- [ ] `r.Context()` is passed from handler down through orchestrator → usecase → repository
- [ ] No `context.Background()` used inside a request path (only acceptable in `main` and tests)

---

## 5. Observability

- [ ] Request counter instrumented at handler layer
- [ ] Error counter incremented on every error path
- [ ] Latency histogram recorded with `time.Since(start)`
- [ ] Structured logging used (`log.From(ctx).Info(...)`) — no `fmt.Printf` in production code
- [ ] Log messages include relevant structured fields (feature_id, operation, etc.)

---

## 6. Testing

- [ ] UseCase tests cover all error paths (not just happy path)
- [ ] Orchestrator test verifies error propagation
- [ ] Handler tests verify correct HTTP status for each error type
- [ ] Repository test covers happy path and at least one error case
- [ ] All mock types have compile-time interface guards

---

## 7. Code Quality

- [ ] No unused imports
- [ ] No exported mutable global variables
- [ ] Constructor functions validate required dependencies (nil check or compile-time guard)
- [ ] No `panic` in request handlers — use error returns
- [ ] HTTP clients initialized once and reused (not created per request)
- [ ] `go vet ./...` passes with no warnings
- [ ] `go build ./...` passes cleanly

---

## 8. API Contract

- [ ] Response shape matches the contract defined in `1-business_layer/`
- [ ] HTTP method matches the operation semantics (no state-changing GET endpoints)
- [ ] Error responses follow `ErrorResponse{Message, Error, Status}` format
- [ ] HTTP status codes match the error type mapping in `handlers/error.go`

---

## Red Flags (Immediate Rejection)

| Finding | Reason |
|---------|--------|
| `os.Getenv("SECRET_KEY")` in source code | Hardcoded secret reference — use Fury Secrets |
| `fmt.Sprintf("SELECT ... WHERE id = '%s'", userInput)` | SQL injection |
| `http.Get(r.URL.Query().Get("url"))` | SSRF — user-controlled URL |
| `log.Info(ctx, "token: "+token)` | Token exposure in logs |
| `var globalCache = map[string][]byte{}` written from handlers | Race condition |
| `errors.New("not found")` returned from repository | Bypasses error type system |
