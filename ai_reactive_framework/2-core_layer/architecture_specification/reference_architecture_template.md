---
description: POD reference architecture — layer diagram, DI wiring order, import alias conventions, interface guard pattern, and package layout rules for {app_name}.
globs:
alwaysApply: false
---

# Reference Architecture — {app_name}

## Architecture Style

Hexagonal Architecture (Ports & Adapters) organized with Package-Oriented Design (POD).
Each feature is a vertical slice — one sub-package per feature at every layer.

---

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  cmd/api/routes/handlers/<feature>/                             │  ← HTTP adapters
│    • FeatureHandler{orchestrator portorch.Orchestrator}         │
│    • func (h) GetFeature(w, r) error                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │ depends on
┌───────────────────────────▼─────────────────────────────────────┐
│  internal/core/port/orchestrator/<feature>/                     │  ← Orchestrator port
│    • interface Orchestrator { GetFeature(ctx) (T, error) }      │
└───────────────────────────┬─────────────────────────────────────┘
                            │ implemented by
┌───────────────────────────▼─────────────────────────────────────┐
│  internal/core/orchestrator/<feature>/                          │  ← Workflow coordinator
│    • orchestrator{featureUC portuc.Service}                     │
│    • NewOrchestrator(featureUC) portorch.Orchestrator           │
└───────────────────────────┬─────────────────────────────────────┘
                            │ depends on
┌───────────────────────────▼─────────────────────────────────────┐
│  internal/core/port/usecase/<feature>/                          │  ← UseCase port
│    • interface Service { GetFeature(ctx) (T, error) }           │
└───────────────────────────┬─────────────────────────────────────┘
                            │ implemented by
┌───────────────────────────▼─────────────────────────────────────┐
│  internal/core/usecase/<feature>/                               │  ← Business logic
│    • service{repo portrepo.Repository}                          │
│    • NewService(repo) portuc.Service                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │ depends on
┌───────────────────────────▼─────────────────────────────────────┐
│  internal/core/port/repository/<feature>/                       │  ← Repository port
│    • interface Repository { GetFeature(ctx) (T, error) }        │
└───────────────────────────┬─────────────────────────────────────┘
                            │ implemented by
┌───────────────────────────▼─────────────────────────────────────┐
│  internal/platform/repository/<feature>/                        │  ← Data access adapter
│    • repository{}                                               │
│    • NewRepository() portrepo.Repository                        │
└─────────────────────────────────────────────────────────────────┘

Cross-cutting:
  internal/core/domain/         ← Pure value types (no external imports)
  internal/core/error/repository/ ← Repository error types
  internal/core/error/usecase/    ← UseCase error types + FromRepositoryError()
  cmd/api/routes/dependencies/    ← DI root (only place that imports all layers)
```

---

## DI Wiring Order

```
BuildClients()
  └─► BuildRepositories(clients)
        └─► BuildUseCases(repos)
              └─► BuildOrchestrators(ucs)
                    └─► BuildHandlers(orchs)
                          └─► App{Handlers, Orchestrators, UseCases, Repositories, Clients}
```

Each `Build*` function in `cmd/api/routes/dependencies/` is responsible for exactly one layer.
`App` struct in `model.go` aggregates all instances — update it when adding a feature.

---

## Import Alias Conventions

Use feature-prefixed aliases when multiple features would produce a collision:

```go
import (
    // No collision — single feature
    portorch "github.com/melisource/{app_name}/internal/core/port/orchestrator/rows"
    portuc   "github.com/melisource/{app_name}/internal/core/port/usecase/rows"
    portrepo "github.com/melisource/{app_name}/internal/core/port/repository/rows"

    // Multi-feature file (e.g., dependencies/model.go) — prefix with feature name
    placeholderportorch "github.com/melisource/{app_name}/internal/core/port/orchestrator/placeholder"
    rowsportorch        "github.com/melisource/{app_name}/internal/core/port/orchestrator/rows"

    ucerr    "github.com/melisource/{app_name}/internal/core/error/usecase"
    repoerr  "github.com/melisource/{app_name}/internal/core/error/repository"
)
```

---

## Compile-time Interface Guard

Every concrete type that implements a port interface **must** include a guard at package level:

```go
// Ensures *service satisfies portuc.Service at compile time.
var _ portuc.Service = (*service)(nil)

// Ensures *orchestrator satisfies portorch.Orchestrator at compile time.
var _ portorch.Orchestrator = (*orchestrator)(nil)

// Ensures *repository satisfies portrepo.Repository at compile time.
var _ portrepo.Repository = (*repository)(nil)
```

Place the guard immediately after the type declaration, before `New*` constructors.

---

## Package Layout Rules

| Rule | Rationale |
|------|-----------|
| One sub-package per feature at each layer | Avoids cross-feature coupling; enables independent testing |
| `domain` imports nothing from this module | Pure value objects; no business or infra logic |
| `port/*` imports `domain` only | Interfaces depend only on value types |
| `usecase` imports `port/repository` + `error/usecase` | Never imports `platform/*` directly |
| `orchestrator` imports `port/usecase` only | Never calls repositories directly |
| `platform/repository` imports `port/repository` + `error/repository` | Infrastructure concerns isolated |
| `handlers` imports `port/orchestrator` + `error/usecase` + `fury_go-core/web` | HTTP concerns isolated |
| `dependencies` may import all layers | It is the composition root — only place allowed to do so |

---

## Error Flow

```
platform/repository
    │  produces: *repoerr.Error{Type: ErrNotFoundKey | ErrInternalServerKey}
    ▼
core/usecase
    │  ucerr.FromRepositoryError(msg, err) translates:
    │    ErrNotFoundKey       → *ucerr.Error{Type: ErrNotFoundKey}
    │    (default)            → *ucerr.Error{Type: ErrInternalServerKey}
    ▼
cmd/api/routes/handlers
    │  HandleError(w, err) maps via mapErrorTypeToHTTPStatus:
    │    not_found_error          → 404
    │    bad_request_error        → 400
    │    forbidden_error          → 403
    │    unauthorized_error       → 401
    │    too_many_requests_error  → 429
    │    failed_dependency_error  → 424
    │    internal_server_error    → 500
    ▼
HTTP response: {"message": "...", "error": "...", "status": NNN}
```

---

## Feature Checklist

When adding a new feature `<feat>`, create or update the following files:

```
internal/core/domain/<feat>.go                            ← domain type(s)
internal/core/port/usecase/<feat>/<feat>.go               ← Service interface
internal/core/port/orchestrator/<feat>/<feat>.go          ← Orchestrator interface
internal/core/port/repository/<feat>/<feat>.go            ← Repository interface
internal/core/usecase/<feat>/service.go                   ← business logic
internal/core/orchestrator/<feat>/orchestrator.go         ← workflow coordination
internal/platform/repository/<feat>/repository.go         ← data access
cmd/api/routes/handlers/<feat>.go                         ← HTTP handler
cmd/api/routes/dependencies/model.go                      ← add fields to App struct
cmd/api/routes/dependencies/clients.go                    ← (if new client needed)
cmd/api/routes/dependencies/repositories.go               ← wire repository
cmd/api/routes/dependencies/usecases.go                   ← wire usecase
cmd/api/routes/dependencies/orchestrators.go              ← wire orchestrator
cmd/api/routes/dependencies/handlers.go                   ← wire handler
cmd/api/routes/router.go                                  ← register route
```
