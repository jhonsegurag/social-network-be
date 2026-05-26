# Architecture Patterns Catalog

> Reference catalog of distributed system patterns. For each pattern: name, description, when to use, Go/Fury implementation sketch, and trade-offs.

---

## Event Sourcing

**Description**
Instead of storing only the current state of an entity, every state change is persisted as an immutable event in an append-only log. The current state is derived by replaying the event history. The event log is the source of truth.

**When to use**
- Auditability is a hard requirement (financial transactions, order lifecycle, compliance logs)
- Temporal queries are needed ("what was the state at time T?")
- Multiple downstream systems need to react to the same state changes independently
- The domain has complex state machines with many valid transitions

**When NOT to use**
- Simple CRUD with no audit requirements — event sourcing adds significant complexity for no gain
- The team is not yet familiar with event replay semantics and projection management

**Go/Fury Implementation Sketch**

```go
// Event store write side
type OrderEvent struct {
    EventID   string          `json:"event_id"`   // ULID — never sequential
    OrderID   string          `json:"order_id"`
    Type      string          `json:"type"`        // "order.created", "order.shipped"
    Payload   json.RawMessage `json:"payload"`
    OccurredAt time.Time      `json:"occurred_at"`
}

// Append event — never update or delete
func (r *eventStoreRepository) AppendEvent(ctx context.Context, event OrderEvent) error {
    // INSERT INTO order_events (event_id, order_id, type, payload, occurred_at)
    // VALUES (?, ?, ?, ?, ?)  ← parameterized query always
}

// Read side: rebuild state by replaying events
func (r *eventStoreRepository) GetCurrentState(ctx context.Context, orderID string) (*domain.Order, error) {
    events, err := r.loadEvents(ctx, orderID)
    if err != nil {
        return nil, err
    }
    return applyEvents(events), nil
}
```

**Trade-offs**

| Pro | Con |
|-----|-----|
| Full audit trail | Complex read path (event replay) |
| Easy temporal queries | Projection management (read models) adds ops burden |
| Decoupled consumers | Schema evolution requires versioning strategy |
| Natural fit for CQRS | Eventual consistency on read side |

---

## CQRS (Command Query Responsibility Segregation)

**Description**
Separates the read model (queries) from the write model (commands) of a system. Commands mutate state; queries read a denormalized projection optimized for the read use case. The two sides can be independently scaled and evolved.

**When to use**
- Read and write workloads have very different performance profiles (read-heavy + complex queries)
- The write model is normalized but the read model requires denormalized views
- Combined with Event Sourcing to build projections from the event log

**When NOT to use**
- Simple services with symmetric read/write load and no complex query requirements
- Small teams where the operational overhead of maintaining two models outweighs the benefit

**Go/Fury Implementation Sketch**

```go
// Command side — write model (normalized)
type CreateOrderCommand struct {
    SellerID string
    Items    []OrderItem
}

type OrderCommandHandler struct {
    repo orderWriteRepository
}

func (h *OrderCommandHandler) Handle(ctx context.Context, cmd CreateOrderCommand) error {
    order := domain.NewOrder(cmd.SellerID, cmd.Items)
    return h.repo.Save(ctx, order)
}

// Query side — read model (denormalized projection)
type OrderSummaryQuery struct {
    SellerID string
    Page     int
}

type OrderQueryHandler struct {
    readRepo orderReadRepository // separate DB/table/cache
}

func (h *OrderQueryHandler) Handle(ctx context.Context, q OrderSummaryQuery) ([]domain.OrderSummary, error) {
    return h.readRepo.GetSummaries(ctx, q.SellerID, q.Page)
}
```

**Trade-offs**

| Pro | Con |
|-----|-----|
| Read/write scale independently | Two models to maintain and synchronize |
| Read model optimized for queries | Eventual consistency between models |
| Simpler write model logic | Increased complexity and codebase surface |

---

## Saga

**Description**
A sequence of local transactions, each publishing an event or message that triggers the next step. If a step fails, compensating transactions are executed in reverse order to undo the already-completed steps. Replaces distributed ACID transactions across microservices.

**When to use**
- A business operation spans multiple microservices and must be eventually consistent
- Rolling back across service boundaries is required (e.g., cancel order → release inventory → refund payment)
- Distributed transactions (2PC) are not available or too costly

**When NOT to use**
- The operation fits within a single service and a local ACID transaction is available
- The compensating logic is unclear or impossible to define (non-reversible side effects)

**Go/Fury Implementation Sketch**

```go
// Choreography-based Saga (event-driven, no central coordinator)
// Step 1: Order service creates order and publishes event
type OrderCreatedEvent struct {
    OrderID string `json:"order_id"`
}
// Step 2: Inventory service listens, reserves stock, publishes event
type StockReservedEvent struct {
    OrderID string `json:"order_id"`
}
// Step 3: Payment service listens, charges card
// On failure: publish PaymentFailedEvent → Inventory releases stock → Order cancelled

// Compensation example
type PaymentFailedEvent struct {
    OrderID string `json:"order_id"`
    Reason  string `json:"reason"`
}

func (h *InventoryCompensationHandler) Handle(ctx context.Context, evt PaymentFailedEvent) error {
    return h.repo.ReleaseReservation(ctx, evt.OrderID)
}
```

**Trade-offs**

| Pro | Con |
|-----|-----|
| No distributed transactions needed | Complex compensating logic |
| Services remain loosely coupled | Harder to debug (distributed event trace required) |
| Scales naturally | Eventual consistency — intermediate states are visible |

---

## Circuit Breaker

**Description**
Wraps calls to a remote service with a state machine (Closed → Open → Half-Open). When failure rate exceeds a threshold, the breaker opens and fast-fails subsequent calls without hitting the downstream, giving it time to recover. After a timeout, it enters Half-Open to probe recovery.

**States**

```
CLOSED ──(error threshold exceeded)──► OPEN ──(timeout elapsed)──► HALF-OPEN
  ▲                                                                      │
  └──────────────────(probe succeeds)───────────────────────────────────┘
                         │
               (probe fails) ──► OPEN
```

**When to use**
- Any outbound call to an external service that could degrade or fail
- Preventing cascade failures: one slow upstream should not exhaust the thread pool of the caller
- Providing fast-fail behavior with a meaningful fallback response

**When NOT to use**
- Calls to local in-process dependencies (no network hop)
- Operations where a fast-fail is worse for the business than waiting (synchronous payment capture)

**Go/Fury Implementation Sketch**

```go
// Using a circuit breaker library (e.g., sony/gobreaker or resilience4j-go equivalent)
import "github.com/sony/gobreaker"

type protectedClient struct {
    cb     *gobreaker.CircuitBreaker
    client upstreamHTTPClient
}

func NewProtectedClient(client upstreamHTTPClient) *protectedClient {
    settings := gobreaker.Settings{
        Name:        "upstream-service",
        MaxRequests: 5,                  // half-open probe requests
        Interval:    10 * time.Second,   // sliding window reset
        Timeout:     30 * time.Second,   // open → half-open after this
        ReadyToTrip: func(counts gobreaker.Counts) bool {
            return counts.ConsecutiveFailures > 5
        },
    }
    return &protectedClient{
        cb:     gobreaker.NewCircuitBreaker(settings),
        client: client,
    }
}

func (c *protectedClient) GetData(ctx context.Context, id string) (*domain.Data, error) {
    result, err := c.cb.Execute(func() (interface{}, error) {
        return c.client.GetData(ctx, id)
    })
    if err != nil {
        // gobreaker returns ErrOpenState when circuit is open
        if errors.Is(err, gobreaker.ErrOpenState) {
            return nil, repoerr.InternalServer("upstream circuit open", err)
        }
        return nil, repoerr.InternalServer("upstream call failed", err)
    }
    return result.(*domain.Data), nil
}
```

**Monitoring the Circuit Breaker**
- Emit a metric on every state transition: `{app_name}.<feature>.circuit_breaker.state_change`
- Label with `from_state` and `to_state` attributes
- Alert when the breaker enters Open state (Datadog monitor on transition count > 0 in 5 min)

**Trade-offs**

| Pro | Con |
|-----|-----|
| Prevents cascade failures | Adds state management and configuration burden |
| Fast-fail frees resources quickly | Threshold tuning is non-trivial |
| Self-healing via Half-Open probe | May mask intermittent issues if threshold too high |
