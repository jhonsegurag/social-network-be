---
description: Go code scaffolding boilerplate — domain type, port interfaces, usecase, orchestrator, repository, HTTP handler, and DI wiring for a new feature in {app_name}.
globs:
alwaysApply: false
---

# Go Scaffolding Template

> **Instructions**: Replace `[Feature]` (PascalCase), `[feature]` (snake_case), and `[operation]`
> with the actual feature name and primary operation. One vertical slice per feature.

---

## 0. Module Reference

```
github.com/melisource/{app_name}
```

---

## 1. Domain Type

```go
// internal/core/domain/[feature].go
package domain

// [Feature] represents a [description of the domain entity].
type [Feature] struct {
    ID   string `json:"id"`
    // Add fields relevant to this feature
}
```

---

## 2. Port Interfaces

### 2a. UseCase Port

```go
// internal/core/port/usecase/[feature]/[feature].go
package [feature]

import (
    "context"

    "github.com/melisource/{app_name}/internal/core/domain"
)

// Service defines the contract for [feature] business logic.
type Service interface {
    [Operation](ctx context.Context) ([]domain.[Feature], error)
}
```

### 2b. Orchestrator Port

```go
// internal/core/port/orchestrator/[feature]/[feature].go
package [feature]

import (
    "context"

    "github.com/melisource/{app_name}/internal/core/domain"
)

// Orchestrator defines the contract for [feature] workflow coordination.
type Orchestrator interface {
    [Operation](ctx context.Context) ([]domain.[Feature], error)
}
```

### 2c. Repository Port

```go
// internal/core/port/repository/[feature]/[feature].go
package [feature]

import (
    "context"

    "github.com/melisource/{app_name}/internal/core/domain"
)

// Repository defines the contract for [feature] data access.
type Repository interface {
    [Operation](ctx context.Context) ([]domain.[Feature], error)
}
```

---

## 3. UseCase (Business Logic)

```go
// internal/core/usecase/[feature]/service.go
package [feature]

import (
    "context"

    "github.com/melisource/{app_name}/internal/core/domain"
    ucerr    "github.com/melisource/{app_name}/internal/core/error/usecase"
    portrepo "github.com/melisource/{app_name}/internal/core/port/repository/[feature]"
    portuc   "github.com/melisource/{app_name}/internal/core/port/usecase/[feature]"
)

// Compile-time interface guard.
var _ portuc.Service = (*service)(nil)

type service struct {
    repo portrepo.Repository
}

// NewService creates a new [feature] usecase service.
func NewService(repo portrepo.Repository) portuc.Service {
    return &service{repo: repo}
}

// [Operation] retrieves [feature description].
func (s *service) [Operation](ctx context.Context) ([]domain.[Feature], error) {
    result, err := s.repo.[Operation](ctx)
    if err != nil {
        return nil, ucerr.FromRepositoryError("error in [feature] [operation]", err)
    }

    return result, nil
}
```

---

## 4. Orchestrator (Workflow Coordinator)

```go
// internal/core/orchestrator/[feature]/orchestrator.go
package [feature]

import (
    "context"

    "github.com/melisource/{app_name}/internal/core/domain"
    portorch "github.com/melisource/{app_name}/internal/core/port/orchestrator/[feature]"
    portuc   "github.com/melisource/{app_name}/internal/core/port/usecase/[feature]"
)

// Compile-time interface guard.
var _ portorch.Orchestrator = (*orchestrator)(nil)

type orchestrator struct {
    [feature]UC portuc.Service
}

// NewOrchestrator creates a new [feature] orchestrator.
func NewOrchestrator([feature]UC portuc.Service) portorch.Orchestrator {
    return &orchestrator{[feature]UC: [feature]UC}
}

// [Operation] coordinates the [feature] retrieval workflow.
func (o *orchestrator) [Operation](ctx context.Context) ([]domain.[Feature], error) {
    result, err := o.[feature]UC.[Operation](ctx)
    if err != nil {
        return nil, err
    }

    return result, nil
}
```

---

## 5. Repository Adapter (Platform)

```go
// internal/platform/repository/[feature]/repository.go
package [feature]

import (
    "context"

    "github.com/melisource/{app_name}/internal/core/domain"
    repoerr  "github.com/melisource/{app_name}/internal/core/error/repository"
    portrepo "github.com/melisource/{app_name}/internal/core/port/repository/[feature]"
)

// Compile-time interface guard.
var _ portrepo.Repository = (*repository)(nil)

type repository struct {
    // Add HTTP client, DB connection, or other infra dependencies here
}

// NewRepository creates a new [feature] repository adapter.
func NewRepository() portrepo.Repository {
    return &repository{}
}

// [Operation] retrieves [feature] data from the upstream source.
func (r *repository) [Operation](_ context.Context) ([]domain.[Feature], error) {
    // TODO: implement actual data access
    // On not found: return nil, repoerr.NotFound("[feature] not found")
    // On infra error: return nil, repoerr.InternalServer("failed to fetch [feature]", err)
    _ = repoerr.NotFound // ensure import is used until implemented
    return []domain.[Feature]{}, nil
}
```

---

## 6. HTTP Handler

```go
// cmd/api/routes/handlers/[feature].go
package handlers

import (
    "net/http"

    portorch "github.com/melisource/{app_name}/internal/core/port/orchestrator/[feature]"
    "github.com/melisource/fury_go-core/pkg/web"
)

// [Feature]Handler handles HTTP requests for the [feature] endpoint.
type [Feature]Handler struct {
    orchestrator portorch.Orchestrator
}

// New[Feature]Handler creates a new [feature] handler.
func New[Feature]Handler(orch portorch.Orchestrator) *[Feature]Handler {
    return &[Feature]Handler{orchestrator: orch}
}

// [Operation] handles GET /[feature] and returns [description].
func (h *[Feature]Handler) [Operation](w http.ResponseWriter, r *http.Request) error {
    result, err := h.orchestrator.[Operation](r.Context())
    if err != nil {
        return HandleError(w, err)
    }

    return web.EncodeJSON(w, result, http.StatusOK)
}
```

---

## 7. DI Wiring

### 7a. model.go — Add fields to App struct

```go
// cmd/api/routes/dependencies/model.go — add [Feature] fields

import (
    [feature]portorch "github.com/melisource/{app_name}/internal/core/port/orchestrator/[feature]"
    [feature]portrepo "github.com/melisource/{app_name}/internal/core/port/repository/[feature]"
    [feature]portuc   "github.com/melisource/{app_name}/internal/core/port/usecase/[feature]"
)

// Add to Handlers struct:
    [Feature] *handlers.[Feature]Handler

// Add to Orchestrators struct:
    [Feature] [feature]portorch.Orchestrator

// Add to UseCases struct:
    [Feature] [feature]portuc.Service

// Add to Repositories struct:
    [Feature] [feature]portrepo.Repository
```

### 7b. repositories.go

```go
import [feature]repo "github.com/melisource/{app_name}/internal/platform/repository/[feature]"

// Inside BuildRepositories:
    [Feature]: [feature]repo.NewRepository(),
```

### 7c. usecases.go

```go
import [feature]uc "github.com/melisource/{app_name}/internal/core/usecase/[feature]"

// Inside BuildUseCases:
    [Feature]: [feature]uc.NewService(repos.[Feature]),
```

### 7d. orchestrators.go

```go
import [feature]orch "github.com/melisource/{app_name}/internal/core/orchestrator/[feature]"

// Inside BuildOrchestrators:
    [Feature]: [feature]orch.NewOrchestrator(ucs.[Feature]),
```

### 7e. handlers.go

```go
// Inside BuildHandlers:
    [Feature]: handlers.New[Feature]Handler(orchs.[Feature]),
```

### 7f. router.go

```go
app.GET("/[feature]", web.Handler(deps.Handlers.[Feature].[Operation]))
```

---

## 8. Error Helper Reference

```go
// Repository layer — use error/repository
repoerr.NotFound("msg", optionalCause)
repoerr.InternalServer("msg", optionalCause)

// UseCase layer — use error/usecase
ucerr.NotFound("msg", optionalCause)
ucerr.BadRequest("msg", optionalCause)
ucerr.Forbidden("msg", optionalCause)
ucerr.Unauthorized("msg", optionalCause)
ucerr.TooManyRequests("msg", optionalCause)
ucerr.InternalServer("msg", optionalCause)
ucerr.FailedDependency("msg", optionalCause)
ucerr.FromRepositoryError("msg", repoErr)  // translates repo → usecase error type
```
