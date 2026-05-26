# Go Scaffolding Guide

> Step-by-step guide to add a new feature vertical slice to `{app_name}`. Follow this checklist in order — each step builds on the previous one.

---

## Prerequisites

- Feature business spec completed in `1-business_layer/`
- Domain entity identified
- API contract defined (HTTP method, path, request/response shape)

---

## Step-by-Step

### 1. Domain Type

Create `internal/core/domain/[feature].go`:

```go
package domain

type [Feature] struct {
    ID string `json:"id"`
    // add fields per API contract
}
```

**Rule**: Domain types must not import anything from this module or any framework.

---

### 2. Port Interfaces

Create three interface files — one per port type:

**`internal/core/port/usecase/[feature]/[feature].go`**
```go
package [feature]

import (
    "context"
    "github.com/melisource/{app_name}/internal/core/domain"
)

type Service interface {
    [Operation](ctx context.Context) ([]domain.[Feature], error)
}
```

**`internal/core/port/orchestrator/[feature]/[feature].go`**
```go
package [feature]

import (
    "context"
    "github.com/melisource/{app_name}/internal/core/domain"
)

type Orchestrator interface {
    [Operation](ctx context.Context) ([]domain.[Feature], error)
}
```

**`internal/core/port/repository/[feature]/[feature].go`**
```go
package [feature]

import (
    "context"
    "github.com/melisource/{app_name}/internal/core/domain"
)

type Repository interface {
    [Operation](ctx context.Context) ([]domain.[Feature], error)
}
```

---

### 3. UseCase

Create `internal/core/usecase/[feature]/service.go`:

```go
package [feature]

import (
    "context"
    "github.com/melisource/{app_name}/internal/core/domain"
    ucerr    "github.com/melisource/{app_name}/internal/core/error/usecase"
    portrepo "github.com/melisource/{app_name}/internal/core/port/repository/[feature]"
    portuc   "github.com/melisource/{app_name}/internal/core/port/usecase/[feature]"
)

var _ portuc.Service = (*service)(nil)

type service struct{ repo portrepo.Repository }

func NewService(repo portrepo.Repository) portuc.Service {
    return &service{repo: repo}
}

func (s *service) [Operation](ctx context.Context) ([]domain.[Feature], error) {
    result, err := s.repo.[Operation](ctx)
    if err != nil {
        return nil, ucerr.FromRepositoryError("error in [feature] [operation]", err)
    }
    return result, nil
}
```

---

### 4. Orchestrator

Create `internal/core/orchestrator/[feature]/orchestrator.go`:

```go
package [feature]

import (
    "context"
    "github.com/melisource/{app_name}/internal/core/domain"
    portorch "github.com/melisource/{app_name}/internal/core/port/orchestrator/[feature]"
    portuc   "github.com/melisource/{app_name}/internal/core/port/usecase/[feature]"
)

var _ portorch.Orchestrator = (*orchestrator)(nil)

type orchestrator struct{ [feature]UC portuc.Service }

func NewOrchestrator(uc portuc.Service) portorch.Orchestrator {
    return &orchestrator{[feature]UC: uc}
}

func (o *orchestrator) [Operation](ctx context.Context) ([]domain.[Feature], error) {
    return o.[feature]UC.[Operation](ctx)
}
```

---

### 5. Repository Adapter

Create `internal/platform/repository/[feature]/repository.go`:

```go
package [feature]

import (
    "context"
    "github.com/melisource/{app_name}/internal/core/domain"
    repoerr  "github.com/melisource/{app_name}/internal/core/error/repository"
    portrepo "github.com/melisource/{app_name}/internal/core/port/repository/[feature]"
)

var _ portrepo.Repository = (*repository)(nil)

type repository struct{
    // client *http.Client  ← inject HTTP client here
}

func NewRepository() portrepo.Repository {
    return &repository{}
}

func (r *repository) [Operation](_ context.Context) ([]domain.[Feature], error) {
    // TODO: real implementation
    // return nil, repoerr.NotFound("[feature] not found")
    // return nil, repoerr.InternalServer("upstream error", err)
    _ = repoerr.NotFound
    return []domain.[Feature]{}, nil
}
```

---

### 6. HTTP Handler

Create `cmd/api/routes/handlers/[feature].go`:

```go
package handlers

import (
    "net/http"
    portorch "github.com/melisource/{app_name}/internal/core/port/orchestrator/[feature]"
    "github.com/melisource/fury_go-core/pkg/web"
)

type [Feature]Handler struct{ orchestrator portorch.Orchestrator }

func New[Feature]Handler(orch portorch.Orchestrator) *[Feature]Handler {
    return &[Feature]Handler{orchestrator: orch}
}

func (h *[Feature]Handler) [Operation](w http.ResponseWriter, r *http.Request) error {
    result, err := h.orchestrator.[Operation](r.Context())
    if err != nil {
        return HandleError(w, err)
    }
    return web.EncodeJSON(w, result, http.StatusOK)
}
```

---

### 7. DI Wiring

Update `cmd/api/routes/dependencies/model.go` — add fields:
```go
// Handlers:      [Feature] *handlers.[Feature]Handler
// Orchestrators: [Feature] [feature]portorch.Orchestrator
// UseCases:      [Feature] [feature]portuc.Service
// Repositories:  [Feature] [feature]portrepo.Repository
```

Update each `Build*` file:
```go
// repositories.go:   [Feature]: [feature]repo.NewRepository()
// usecases.go:       [Feature]: [feature]uc.NewService(repos.[Feature])
// orchestrators.go:  [Feature]: [feature]orch.NewOrchestrator(ucs.[Feature])
// handlers.go:       [Feature]: handlers.New[Feature]Handler(orchs.[Feature])
```

---

### 8. Route Registration

In `cmd/api/routes/router.go`:
```go
app.GET("/[feature]", web.Handler(deps.Handlers.[Feature].[Operation]))
```

---

### 9. Tests

Create test files per layer (see `testing_template.mdc`):
```
internal/core/usecase/[feature]/service_test.go
internal/core/orchestrator/[feature]/orchestrator_test.go
cmd/api/routes/handlers/[feature]_test.go
internal/platform/repository/[feature]/repository_test.go
```

---

### 10. Verify

```bash
go build ./...
go test ./...
go vet ./...
```
