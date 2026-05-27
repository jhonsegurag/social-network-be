---
description: Go testify/suite patterns — table-driven tests, mock patterns, and suite setup/teardown for handler, usecase, orchestrator, and repository layers in {app_name}.
globs:
alwaysApply: false
---

# Go Testing Template — testify/suite

## Conventions

- Use `testify/suite` for all layer tests.
- Use table-driven tests (`[]struct{ name, input, expected, wantErr }`) for all non-trivial cases.
- Mocks are hand-rolled structs implementing the port interfaces — no external mock generator required unless already used in the project.
- Test file lives alongside the production file: `service_test.go` next to `service.go`.
- Test package: `package [feature]_test` (black-box) or `package [feature]` (white-box, for internal helpers).
- All test functions follow `Test[Suite]` → registered via `suite.Run(t, new([Suite]))`.

---

## 1. UseCase Layer Test

```go
// internal/core/usecase/[feature]/service_test.go
package [feature]_test

import (
    "context"
    "errors"
    "testing"

    "github.com/stretchr/testify/suite"

    "github.com/melisource/{app_name}/internal/core/domain"
    repoerr  "github.com/melisource/{app_name}/internal/core/error/repository"
    ucerr    "github.com/melisource/{app_name}/internal/core/error/usecase"
    portrepo "github.com/melisource/{app_name}/internal/core/port/repository/[feature]"
    "[module]/internal/core/usecase/[feature]"
)

// --- Mock ---

type mock[Feature]Repository struct {
    result []domain.[Feature]
    err    error
}

// Compile-time interface guard for mock.
var _ portrepo.Repository = (*mock[Feature]Repository)(nil)

func (m *mock[Feature]Repository) [Operation](_ context.Context) ([]domain.[Feature], error) {
    return m.result, m.err
}

// --- Suite ---

type [Feature]ServiceSuite struct {
    suite.Suite
}

func Test[Feature]Service(t *testing.T) {
    suite.Run(t, new([Feature]ServiceSuite))
}

// --- Tests ---

func (s *[Feature]ServiceSuite) Test[Operation]_Success() {
    tests := []struct {
        name     string
        repoData []domain.[Feature]
        wantLen  int
    }{
        {
            name:     "returns single item",
            repoData: []domain.[Feature]{{ID: "abc"}},
            wantLen:  1,
        },
        {
            name:     "returns empty list",
            repoData: []domain.[Feature]{},
            wantLen:  0,
        },
    }

    for _, tt := range tests {
        s.Run(tt.name, func() {
            repo := &mock[Feature]Repository{result: tt.repoData}
            svc := [feature].NewService(repo)

            got, err := svc.[Operation](context.Background())

            s.NoError(err)
            s.Len(got, tt.wantLen)
        })
    }
}

func (s *[Feature]ServiceSuite) Test[Operation]_Error() {
    tests := []struct {
        name          string
        repoErr       error
        wantErrType   ucerr.ErrorType
    }{
        {
            name:        "repo not found → usecase not found",
            repoErr:     repoerr.NotFound("[feature] not found"),
            wantErrType: ucerr.ErrNotFoundKey,
        },
        {
            name:        "repo internal error → usecase internal error",
            repoErr:     repoerr.InternalServer("db connection failed"),
            wantErrType: ucerr.ErrInternalServerKey,
        },
        {
            name:        "unknown error → usecase internal error",
            repoErr:     errors.New("unexpected"),
            wantErrType: ucerr.ErrInternalServerKey,
        },
    }

    for _, tt := range tests {
        s.Run(tt.name, func() {
            repo := &mock[Feature]Repository{err: tt.repoErr}
            svc := [feature].NewService(repo)

            _, err := svc.[Operation](context.Background())

            s.Error(err)
            ucErr := ucerr.GetError(err)
            s.Require().NotNil(ucErr)
            s.Equal(tt.wantErrType, ucErr.Type)
        })
    }
}
```

---

## 2. Orchestrator Layer Test

```go
// internal/core/orchestrator/[feature]/orchestrator_test.go
package [feature]_test

import (
    "context"
    "testing"

    "github.com/stretchr/testify/suite"

    "github.com/melisource/{app_name}/internal/core/domain"
    ucerr  "github.com/melisource/{app_name}/internal/core/error/usecase"
    portuc "github.com/melisource/{app_name}/internal/core/port/usecase/[feature]"
    "[module]/internal/core/orchestrator/[feature]"
)

// --- Mock ---

type mock[Feature]Service struct {
    result []domain.[Feature]
    err    error
}

var _ portuc.Service = (*mock[Feature]Service)(nil)

func (m *mock[Feature]Service) [Operation](_ context.Context) ([]domain.[Feature], error) {
    return m.result, m.err
}

// --- Suite ---

type [Feature]OrchestratorSuite struct {
    suite.Suite
}

func Test[Feature]Orchestrator(t *testing.T) {
    suite.Run(t, new([Feature]OrchestratorSuite))
}

// --- Tests ---

func (s *[Feature]OrchestratorSuite) Test[Operation]_DelegatesSuccessfully() {
    expected := []domain.[Feature]{{ID: "xyz"}}
    svc := &mock[Feature]Service{result: expected}
    orch := [feature].NewOrchestrator(svc)

    got, err := orch.[Operation](context.Background())

    s.NoError(err)
    s.Equal(expected, got)
}

func (s *[Feature]OrchestratorSuite) Test[Operation]_PropagatesError() {
    svc := &mock[Feature]Service{err: ucerr.NotFound("[feature] not found")}
    orch := [feature].NewOrchestrator(svc)

    _, err := orch.[Operation](context.Background())

    s.Error(err)
    ucErr := ucerr.GetError(err)
    s.Require().NotNil(ucErr)
    s.Equal(ucerr.ErrNotFoundKey, ucErr.Type)
}
```

---

## 3. Handler Layer Test

```go
// cmd/api/routes/handlers/[feature]_test.go
package handlers_test

import (
    "context"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/stretchr/testify/suite"

    "github.com/melisource/{app_name}/cmd/api/routes/handlers"
    "github.com/melisource/{app_name}/internal/core/domain"
    ucerr    "github.com/melisource/{app_name}/internal/core/error/usecase"
    portorch "github.com/melisource/{app_name}/internal/core/port/orchestrator/[feature]"
)

// --- Mock ---

type mock[Feature]Orchestrator struct {
    result []domain.[Feature]
    err    error
}

var _ portorch.Orchestrator = (*mock[Feature]Orchestrator)(nil)

func (m *mock[Feature]Orchestrator) [Operation](_ context.Context) ([]domain.[Feature], error) {
    return m.result, m.err
}

// --- Suite ---

type [Feature]HandlerSuite struct {
    suite.Suite
}

func Test[Feature]Handler(t *testing.T) {
    suite.Run(t, new([Feature]HandlerSuite))
}

// --- Tests ---

func (s *[Feature]HandlerSuite) Test[Operation]_Returns200() {
    expected := []domain.[Feature]{{ID: "test-1"}}
    orch := &mock[Feature]Orchestrator{result: expected}
    h := handlers.New[Feature]Handler(orch)

    req := httptest.NewRequest(http.MethodGet, "/[feature]", nil)
    rec := httptest.NewRecorder()

    err := h.[Operation](rec, req)

    s.NoError(err)
    s.Equal(http.StatusOK, rec.Code)

    var got []domain.[Feature]
    s.Require().NoError(json.NewDecoder(rec.Body).Decode(&got))
    s.Equal(expected, got)
}

func (s *[Feature]HandlerSuite) Test[Operation]_Returns404OnNotFound() {
    orch := &mock[Feature]Orchestrator{err: ucerr.NotFound("[feature] not found")}
    h := handlers.New[Feature]Handler(orch)

    req := httptest.NewRequest(http.MethodGet, "/[feature]", nil)
    rec := httptest.NewRecorder()

    err := h.[Operation](rec, req)

    // HandleError writes the response; handler returns nil
    s.NoError(err)
    s.Equal(http.StatusNotFound, rec.Code)

    var resp handlers.ErrorResponse
    s.Require().NoError(json.NewDecoder(rec.Body).Decode(&resp))
    s.Equal("not_found_error", resp.Error)
    s.Equal(http.StatusNotFound, resp.Status)
}

func (s *[Feature]HandlerSuite) Test[Operation]_Returns500OnInternalError() {
    orch := &mock[Feature]Orchestrator{err: ucerr.InternalServer("unexpected failure")}
    h := handlers.New[Feature]Handler(orch)

    req := httptest.NewRequest(http.MethodGet, "/[feature]", nil)
    rec := httptest.NewRecorder()

    err := h.[Operation](rec, req)

    s.NoError(err)
    s.Equal(http.StatusInternalServerError, rec.Code)
}
```

---

## 4. Repository Layer Test

```go
// internal/platform/repository/[feature]/repository_test.go
package [feature]_test

import (
    "context"
    "testing"

    "github.com/stretchr/testify/suite"

    "[module]/internal/platform/repository/[feature]"
)

type [Feature]RepositorySuite struct {
    suite.Suite
}

func Test[Feature]Repository(t *testing.T) {
    suite.Run(t, new([Feature]RepositorySuite))
}

func (s *[Feature]RepositorySuite) SetupTest() {
    // Initialize test state (e.g., in-memory DB, HTTP test server) before each test
}

func (s *[Feature]RepositorySuite) TearDownTest() {
    // Clean up after each test
}

func (s *[Feature]RepositorySuite) Test[Operation]_ReturnsData() {
    repo := [feature].NewRepository()

    got, err := repo.[Operation](context.Background())

    s.NoError(err)
    s.NotNil(got)
}

// Add error-path tests as the repository implementation grows:
// func (s *[Feature]RepositorySuite) Test[Operation]_ReturnsNotFoundError() { ... }
// func (s *[Feature]RepositorySuite) Test[Operation]_ReturnsInternalErrorOnTimeout() { ... }
```

---

## 5. Suite Lifecycle Hooks

```go
// Available testify/suite hooks — use only what you need:

func (s *MySuite) SetupSuite() {
    // Runs once before all tests in the suite (e.g., start test DB)
}

func (s *MySuite) TearDownSuite() {
    // Runs once after all tests in the suite (e.g., stop test DB)
}

func (s *MySuite) SetupTest() {
    // Runs before each test (e.g., reset mocks, truncate tables)
}

func (s *MySuite) TearDownTest() {
    // Runs after each test (e.g., verify no unexpected calls, rollback TX)
}

func (s *MySuite) BeforeTest(suiteName, testName string) {
    // Fine-grained setup per individual test name
}
```

---

## 6. Error Assertion Helpers

```go
// Assert a specific usecase error type
func assertUCErrorType(s *suite.Suite, err error, expected ucerr.ErrorType) {
    s.T().Helper()
    ucErr := ucerr.GetError(err)
    s.Require().NotNil(ucErr, "expected a usecase error, got nil")
    s.Equal(expected, ucErr.Type,
        "expected error type %s, got %s", expected, ucErr.Type)
}

// Usage:
assertUCErrorType(&s.Suite, err, ucerr.ErrNotFoundKey)
```

---

## 7. Test File Checklist

For every new feature, create the following test files:

```
internal/core/usecase/[feature]/service_test.go         ← usecase success + all error paths
internal/core/orchestrator/[feature]/orchestrator_test.go ← delegation + error propagation
cmd/api/routes/handlers/[feature]_test.go               ← 200, 404, 500 HTTP responses
internal/platform/repository/[feature]/repository_test.go ← happy path + error cases
```

Minimum coverage targets:
- UseCase: 100% of error branches
- Orchestrator: error propagation verified
- Handler: one test per HTTP status code produced
- Repository: happy path + at least one error path
