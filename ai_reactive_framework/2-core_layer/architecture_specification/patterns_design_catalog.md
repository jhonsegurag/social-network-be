# Design Patterns Catalog

> Reference catalog of software design patterns used in this project. Organized by category. Each entry includes: intent, structure, Go example, and applicability.

---

## Creational Patterns

### Repository

**Intent**
Encapsulates data access logic behind an interface, decoupling business logic from the persistence mechanism. The business layer never knows whether data comes from a database, HTTP client, cache, or stub.

**Structure**
```
port/repository/<feature>/  ← interface (port)
platform/repository/<feature>/ ← implementation (adapter)
```

**Go Example**
```go
// Port — interface defined in core layer
type Repository interface {
    GetByID(ctx context.Context, id string) (*domain.Feature, error)
}

// Adapter — implementation in platform layer
type repository struct{ client *http.Client }

var _ portrepo.Repository = (*repository)(nil) // compile-time guard

func (r *repository) GetByID(ctx context.Context, id string) (*domain.Feature, error) {
    // actual HTTP/DB call
}
```

**When to use**: Always. Every data access operation in this project goes through a repository interface.

---

### Factory (Constructor Function)

**Intent**
Encapsulates object creation, ensuring all required dependencies are injected and invariants are validated at construction time.

**Go Example**
```go
func NewService(repo portrepo.Repository) portuc.Service {
    // validate required deps at construction — fail fast
    if repo == nil {
        panic("rows: repository is required")
    }
    return &service{repo: repo}
}
```

**When to use**: For every `New*` constructor in the codebase. Never expose struct literals outside the package.

---

## Structural Patterns

### Adapter

**Intent**
Converts the interface of a class/type into another interface that clients expect. Allows incompatible types to work together.

**In this project**: Every `internal/platform/repository/<feature>/` file is an adapter — it implements the port interface using an external HTTP client or DB driver.

**Go Example**
```go
// Port interface expected by the use case
type Repository interface {
    GetRows(ctx context.Context) ([]domain.Row, error)
}

// Adapter wraps an external API client
type repository struct {
    client *upstreamapi.Client
}

func (r *repository) GetRows(ctx context.Context) ([]domain.Row, error) {
    // Call upstream, map response to domain.Row
    apiResp, err := r.client.FetchOrders(ctx)
    if err != nil {
        return nil, repoerr.InternalServer("failed to fetch orders", err)
    }
    return mapToDomain(apiResp), nil
}
```

---

### Decorator / Middleware

**Intent**
Adds behavior (logging, metrics, circuit breaking, caching) to an object dynamically without modifying the underlying implementation.

**Go Example**
```go
// Wraps a repository with metrics recording
type instrumentedRepository struct {
    inner   portrepo.Repository
    metrics *metrics.Metrics
}

var _ portrepo.Repository = (*instrumentedRepository)(nil)

func (r *instrumentedRepository) GetRows(ctx context.Context) ([]domain.Row, error) {
    start := time.Now()
    result, err := r.inner.GetRows(ctx)
    status := "success"
    if err != nil {
        status = "error"
        r.metrics.RecordError(ctx, "get_rows", ucerr.GetError(err).Type.String())
    }
    r.metrics.RecordLatency(ctx, "get_rows", status, start)
    return result, err
}
```

**When to use**: For cross-cutting concerns (metrics, logging, circuit breaking) that should not pollute the core implementation.

---

## Behavioral Patterns

### Strategy

**Intent**
Defines a family of algorithms, encapsulates each one, and makes them interchangeable. The client selects the strategy at runtime via the interface.

**In this project**: Port interfaces act as strategies — different implementations (stub, HTTP, DB) are injected at startup via DI without changing the business logic.

**Go Example**
```go
// Strategy interface (same as port/repository)
type PricingStrategy interface {
    Calculate(ctx context.Context, items []domain.Item) (domain.Price, error)
}

// Concrete strategies
type localCurrencyPricing struct{}
type crossBorderPricing struct{}

// Client selects strategy at construction — no runtime branching in business logic
```

---

### Chain of Responsibility

**Intent**
Passes a request through a chain of handlers. Each handler decides to process the request or pass it to the next handler.

**In this project**: HTTP middleware pipeline. Fury's `web.Handler` wraps handlers in a middleware chain for auth, logging, tracing.

**Go Example**
```go
// Middleware signature
type Middleware func(http.Handler) http.Handler

func LoggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        log.From(r.Context()).Info(r.Context(), "inbound request",
            log.Field("method", r.Method),
            log.Field("path", r.URL.Path))
        next.ServeHTTP(w, r)
    })
}
```

---

### Template Method

**Intent**
Defines the skeleton of an algorithm in a base structure, deferring some steps to sub-implementations.

**Go Example**
```go
// Orchestrator defines the workflow skeleton; delegates steps to injected services
func (o *orchestrator) ProcessOrder(ctx context.Context, id string) (*domain.OrderResult, error) {
    // Step 1: validate order exists (delegated to orderUC)
    order, err := o.orderUC.GetByID(ctx, id)
    if err != nil {
        return nil, err
    }
    // Step 2: check inventory (delegated to inventoryUC)
    if err := o.inventoryUC.Reserve(ctx, order.Items); err != nil {
        return nil, err
    }
    // Step 3: confirm (delegated to confirmationUC)
    return o.confirmationUC.Confirm(ctx, order)
}
```

**When to use**: Orchestrators in this project follow this pattern — they define the workflow sequence and delegate each step to a dedicated use case.

---

## Concurrency Patterns

### Context Propagation

**Intent**
Passes request-scoped values (trace ID, cancellation signal, deadline) through the call stack without polluting function signatures.

**Rule in this project**: `context.Context` is always the first parameter of any function that performs I/O or could be cancelled.

```go
// ✅ Correct — context propagated
func (s *service) GetRows(ctx context.Context) ([]domain.Row, error) {
    return s.repo.GetRows(ctx)
}

// ❌ Wrong — context dropped
func (s *service) GetRows() ([]domain.Row, error) {
    return s.repo.GetRows(context.Background()) // loses deadline and trace
}
```

---

### Fan-Out / Fan-In

**Intent**
Distributes work across multiple goroutines (fan-out) and collects results (fan-in) to parallelize independent I/O operations.

**Go Example**
```go
func (o *orchestrator) GetAggregatedData(ctx context.Context, id string) (*domain.Result, error) {
    type result struct {
        orders    []domain.Order
        shipments []domain.Shipment
        err       error
    }

    ordersCh := make(chan result, 1)
    shipmentsCh := make(chan result, 1)

    go func() {
        orders, err := o.ordersUC.GetByID(ctx, id)
        ordersCh <- result{orders: orders, err: err}
    }()

    go func() {
        shipments, err := o.shipmentsUC.GetByOrderID(ctx, id)
        shipmentsCh <- result{shipments: shipments, err: err}
    }()

    ordersRes := <-ordersCh
    shipmentsRes := <-shipmentsCh

    if ordersRes.err != nil {
        return nil, ordersRes.err
    }
    if shipmentsRes.err != nil {
        return nil, shipmentsRes.err
    }

    return aggregate(ordersRes.orders, shipmentsRes.shipments), nil
}
```

**Security note**: Never share mutable state between goroutines. Each goroutine must operate on its own copy of request-scoped data.
