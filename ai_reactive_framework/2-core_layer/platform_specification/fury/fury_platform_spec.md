---
description: Platform Go platform patterns — bootstrap, routing, config, secrets, middleware, and error-handling conventions for fury_go-core and fury_go-platform.
globs:
alwaysApply: false
---

# Platform Go Platform Specification

## Module

```
github.com/melisource/{app_name}
```

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `github.com/melisource/fury_go-platform` | App bootstrap, lifecycle management |
| `github.com/melisource/fury_go-core/pkg/web` | HTTP routing, handler wrapper, JSON encoding |
| `github.com/spf13/viper` | Config loading from YAML / env vars |

---

## 1. Application Bootstrap

Platform apps are bootstrapped via `fury_go-platform`. The entry point wires config, routes, and DI before starting:

```go
// cmd/api/main.go
package main

import (
    "github.com/melisource/fury_go-platform/pkg/Platform"
    "github.com/melisource/{app_name}/cmd/api/routes"
)

func main() {
    app, err := Platform.NewWebApplication()
    if err != nil {
        panic(err)
    }
    routes.Register(app)
    app.Run()
}
```

- `Platform.NewWebApplication()` auto-registers `/ping` (health check) — do **not** add a duplicate.
- `app.Run()` blocks until the process receives a termination signal.

---

## 2. Route Registration

Routes are registered in `cmd/api/routes/router.go`. Handler methods must match the `web.Handler` signature:

```go
// cmd/api/routes/router.go
package routes

import (
    "github.com/melisource/fury_go-core/pkg/web"
    "github.com/melisource/fury_go-platform/pkg/Platform"
    "github.com/melisource/{app_name}/cmd/api/routes/dependencies"
)

func Register(app *Platform.Application) {
    deps := dependencies.Build()

    // Group routes under /api/v1
    app.GET("/rows",         web.Handler(deps.Handlers.Rows.GetRows))
    app.POST("/feature",     web.Handler(deps.Handlers.Feature.Create))
}
```

### `web.Handler` wrapper

`web.Handler` converts a `func(http.ResponseWriter, *http.Request) error` into a standard `http.HandlerFunc`, handling panics and propagating errors through Platform's middleware chain.

Never register raw `http.HandlerFunc` directly — always use `web.Handler`.

---

## 3. Config Loading (Viper)

Config files live at `config/<env>.yaml`. Loaded automatically by `fury_go-platform` on boot.

```go
// internal/platform/config/config.go
package config

import "github.com/spf13/viper"

type Config struct {
    SomeServiceURL string `mapstructure:"some_service_url"`
    TimeoutSeconds int    `mapstructure:"timeout_seconds"`
}

func Load() (*Config, error) {
    var cfg Config
    if err := viper.Unmarshal(&cfg); err != nil {
        return nil, err
    }
    return &cfg, nil
}
```

```yaml
# config/local.yaml
some_service_url: "http://localhost:8081"
timeout_seconds: 5
```

---

## 4. Secrets (Platform Secrets Service)

Secrets are injected as environment variables by Platform at runtime. **Never hardcode** secrets.

```go
// Access secrets via os.Getenv — never hardcode
import "os"

apiKey := os.Getenv("SOME_API_KEY") // injected by Platform Secrets Service
```

Declare required secrets in `Platform-secrets.yaml` (Platform infrastructure config). No application-level secret loading library needed.

---

## 5. HTTP Handler Pattern

All handlers follow the same structure:

```go
// cmd/api/routes/handlers/<feature>.go
package handlers

import (
    "net/http"

    portorch "github.com/melisource/{app_name}/internal/core/port/orchestrator/<feature>"
    "github.com/melisource/fury_go-core/pkg/web"
)

type FeatureHandler struct {
    orchestrator portorch.Orchestrator
}

func NewFeatureHandler(orch portorch.Orchestrator) *FeatureHandler {
    return &FeatureHandler{orchestrator: orch}
}

// GetFeature handles GET /feature
func (h *FeatureHandler) GetFeature(w http.ResponseWriter, r *http.Request) error {
    result, err := h.orchestrator.GetFeature(r.Context())
    if err != nil {
        return HandleError(w, err)    // maps usecase errors → HTTP status
    }
    return web.EncodeJSON(w, result, http.StatusOK)
}
```

### Request body decoding

```go
import "github.com/melisource/fury_go-core/pkg/web"

var req FeatureRequest
if err := web.DecodeJSON(r, &req); err != nil {
    return HandleError(w, ucerr.BadRequest("invalid request body", err))
}
```

### Path parameter extraction

```go
// fury_go-core router provides path vars via context
import "github.com/melisource/fury_go-core/pkg/web"

id := web.Vars(r)["id"]
```

---

## 6. Error Mapping

Errors bubble up through layers. The handler converts them to HTTP responses via `HandleError`:

```go
// cmd/api/routes/handlers/error.go — already implemented

// ErrorType → HTTP Status mapping:
// not_found_error          → 404
// bad_request_error        → 400
// forbidden_error          → 403
// unauthorized_error       → 401
// too_many_requests_error  → 429
// failed_dependency_error  → 424
// internal_server_error    → 500
```

Error response body:
```json
{
  "message": "human-readable error description",
  "error": "error_type_key",
  "status": 404
}
```

Never expose internal error details (stack traces, SQL messages, downstream URLs) in the response body.

---

## 7. Middleware

Platform platform handles cross-cutting concerns centrally:
- **Authentication / Authorization** — use SpyriaIT's standard authorization SDK.
- **Security headers** (CSP, HSTS, X-Frame-Options) — managed by Platform. Do **not** set at app level.
- **CORS** — managed by Platform. Do **not** configure at app level.
- **Request tracing** — `fury_go-platform` injects trace context; propagate via `r.Context()`.
- **Rate limiting** — configured at infrastructure level, not in application code.

---

## 8. Dependency Injection

DI is manual constructor injection. No DI framework. Build order:

```go
// cmd/api/routes/dependencies/wire.go
func Build() App {
    clients  := BuildClients()              // external HTTP/gRPC clients
    repos    := BuildRepositories(clients)  // platform/repository adapters
    ucs      := BuildUseCases(repos)        // core/usecase services
    orchs    := BuildOrchestrators(ucs)     // core/orchestrator coordinators
    handlers := BuildHandlers(orchs)        // cmd/api/routes/handlers
    return App{Handlers: handlers, ...}
}
```

Adding a new feature requires updating each of the five `Build*` functions and the `App` struct in `model.go`.

---

## 9. Input Validation

Use `go-playground/validator/v10` with struct tags. Validate at the handler boundary before passing to the orchestrator:

```go
import "github.com/go-playground/validator/v10"

var validate = validator.New()

type CreateFeatureRequest struct {
    Name  string `json:"name"  validate:"required,min=1,max=100"`
    Email string `json:"email" validate:"required,email"`
}

if err := validate.Struct(req); err != nil {
    return HandleError(w, ucerr.BadRequest("validation failed", err))
}
```

- Use whitelist validation — reject unknown/unvalidated fields.
- Never pass raw user input to SQL, HTTP clients, or shell commands.

---

## 10. Logging

Use Platform's structured logger (JSON output). Access via context:

```go
import "github.com/melisource/fury_go-core/pkg/log"

logger := log.From(ctx)
logger.Info(ctx, "processing feature request", log.Field("feature_id", id))
logger.Error(ctx, "repository error", log.Error(err))
```

- Log correlation IDs by always passing `ctx` — Platform injects the trace ID automatically.
- Never log PII, secrets, tokens, or passwords.
- Use `log.Field(key, value)` for structured fields — never interpolate values into the message string.
