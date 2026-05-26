# Go Platform Specification

> Go coding standards and platform patterns for Fury PaaS microservices at MercadoLibre. Apply to all Go services in the `{app_name}` ecosystem.

---

## Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Language | Go | 1.22.5 |
| Platform | Fury PaaS | — |
| HTTP framework | `fury_go-core/pkg/web` | v1.13.2 |
| Bootstrap | `fury_go-platform` | v1.17.1 |
| Validation | `go-playground/validator/v10` | v10.30.1 |
| Config | `spf13/viper` | v1.21.0 |
| Metrics | `go.opentelemetry.io/otel/metric` | v1.41.0 |
| Testing | `testify/suite` | v1.11.1 |
| Module registry | `go.artifacts.furycloud.io` | — |

---

## Architecture

Package-Oriented Design (POD) with Hexagonal Architecture. See `reference_architecture_template.mdc` for full layer diagram.

```
cmd/api/routes/handlers/      ← HTTP adapters
internal/core/port/           ← Port interfaces (dependency inversion)
internal/core/usecase/        ← Business logic
internal/core/orchestrator/   ← Workflow coordination
internal/platform/repository/ ← Data access adapters
```

---

## Code Standards

### Naming
- Exported types: `PascalCase`
- Unexported fields/vars: `camelCase`
- Test files: `_test.go` suffix, `package foo_test` (black-box) or `package foo` (white-box)
- Error variables: `Err` prefix for sentinel errors (`ErrNotFound`)
- Interface names: one-method interfaces use the method name + `er` (`Reader`, `Writer`)

### Error Handling

Always handle errors explicitly. Never ignore `error` return values.

```go
// ✅ Correct
result, err := s.repo.GetByID(ctx, id)
if err != nil {
    return nil, ucerr.FromRepositoryError("error getting feature", err)
}

// ❌ Wrong — ignored error
result, _ := s.repo.GetByID(ctx, id)
```

Error types follow the two-layer pattern:
1. `internal/core/error/repository` — repository-layer errors
2. `internal/core/error/usecase` — usecase-layer errors (translation via `FromRepositoryError`)

### Context
- `context.Context` is always the first parameter in functions that perform I/O
- Never store context in a struct field — pass it as a parameter
- Always propagate context from `r.Context()` down the call stack

### Interfaces
- Define interfaces at the **consumer** side (port), not the producer side
- Compile-time interface guard on every concrete implementation:
  ```go
  var _ portuc.Service = (*service)(nil)
  ```
- Keep interfaces small — prefer one-method interfaces where possible

### Concurrency
- Never mutate global or package-level variables from request handlers or goroutines
- Use `sync.Mutex` or channels for shared mutable state
- Always pass context to goroutines to enable cancellation

---

## HTTP Handler Pattern

```go
func (h *FeatureHandler) GetFeature(w http.ResponseWriter, r *http.Request) error {
    result, err := h.orchestrator.GetFeature(r.Context())
    if err != nil {
        return HandleError(w, err)  // maps usecase error → HTTP status
    }
    return web.EncodeJSON(w, result, http.StatusOK)
}
```

- Return `error` from handlers — Fury's `web.Handler` wrapper handles the response on non-nil error
- Use `web.EncodeJSON` — never write to `http.ResponseWriter` directly
- Use `web.DecodeJSON` for request body decoding

---

## Configuration

```go
// All config via viper — keys match config/<env>.yaml
someURL := viper.GetString("some_service_url")
timeout := viper.GetDuration("timeout")
```

Never hardcode URLs, timeouts, or credentials.

---

## Logging

```go
import "github.com/melisource/fury_go-core/pkg/log"

log.From(ctx).Info(ctx, "message", log.Field("key", value))
log.From(ctx).Error(ctx, "error message", log.Error(err))
```

- Always pass `ctx` — it carries the trace ID
- Never log PII, tokens, passwords, or raw error stacks
- Use structured fields — never interpolate values into the message string

---

## Testing

- Use `testify/suite` for all test suites
- Table-driven tests for all multi-case scenarios
- Hand-rolled mocks implementing port interfaces (no mock generator required)
- Test at each layer independently — never test the full stack in a unit test

See `testing_template.mdc` for full patterns.

---

## Security Checklist

- [ ] No hardcoded secrets or credentials
- [ ] All input validated with `validator.Struct()` at handler boundary
- [ ] No raw SQL with user input — parameterized queries only
- [ ] No PII in logs or error responses
- [ ] Authorization via MercadoLibre SDK, not custom logic
- [ ] No global mutable state in handlers
- [ ] All outbound HTTP calls use allowlisted URLs — never user-controlled
