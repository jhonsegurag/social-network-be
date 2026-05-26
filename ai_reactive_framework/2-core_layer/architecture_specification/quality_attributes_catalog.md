# Quality Attributes Catalog

> Reference catalog of system quality attributes (non-functional requirements). Use when evaluating architectural decisions, writing ADRs, or defining SLOs for a feature.

---

## Responsiveness

**Description**
The ability of the system to handle requests and deliver results within user-perceived time bounds, even under varying load conditions. Responsiveness is the runtime perception of speed — not just raw throughput.

**Key metrics**
- P50 / P95 / P99 latency per endpoint
- Time-to-first-byte (TTFB)
- End-to-end response time as perceived by the client

**Tactics**
- Introduce caching at repository layer to avoid redundant upstream calls
- Use async/non-blocking I/O where the runtime permits
- Apply timeouts on all outbound HTTP calls (`http.Client{Timeout: ...}`)
- Paginate large result sets instead of streaming everything
- Pre-compute or denormalize data that is expensive to assemble at request time

**Trade-offs**
- Improved responsiveness via caching introduces cache invalidation complexity
- Async processing improves throughput but complicates error handling and observability

**In this project**
- All outbound clients must set explicit read/write timeouts (config via `viper`)
- P99 latency SLO must be defined per endpoint in the observability layer

---

## Resilience

**Description**
The ability of the system to continue operating correctly, or degrade gracefully, in the presence of partial failures — including upstream service outages, network partitions, and hardware faults.

**Key metrics**
- Error rate (5xx responses / total requests)
- MTTR (mean time to recover)
- Circuit breaker open/close transition rate

**Tactics**
- Implement circuit breaker pattern for all outbound calls to external services
- Apply retry with exponential backoff + jitter for transient failures
- Use bulkhead pattern to isolate critical dependencies from non-critical ones
- Return meaningful degraded responses (partial data, cached fallback) when possible
- Define and enforce SLOs with error budgets

**Trade-offs**
- Retries reduce transient failure impact but can amplify load on a struggling upstream
- Bulkheads increase resource isolation but add complexity to thread/connection pool management

**In this project**
- Use `failed_dependency_error` (HTTP 424) to signal upstream failures to callers
- Repository errors must always be mapped through `FromRepositoryError()` — never swallowed

---

## Elasticity

**Description**
The ability of the system to dynamically acquire and release resources in response to changing workload demands, maintaining performance SLOs without manual intervention.

**Key metrics**
- Scale-out latency (time from load increase to additional capacity being active)
- Resource utilization efficiency (CPU, memory at nominal vs peak)
- Cost per request at different load levels

**Tactics**
- Design stateless request handlers — all request state lives in the request context, never in package-level variables
- Externalize configuration and secrets (no rebuild needed to change capacity parameters)
- Use horizontal scaling (add instances) rather than vertical scaling (bigger machines)
- Avoid long-lived goroutines that hold resources across requests

**Trade-offs**
- Stateless design simplifies elasticity but requires external state stores (cache, DB) that have their own scaling constraints
- Fine-grained microservices scale independently but increase operational overhead

**In this project**
- Fury PaaS handles horizontal scaling automatically — application code must be stateless
- Never use global mutable variables in request handlers (violates Fury's security & scaling requirements)

---

## Performance

**Description**
The efficiency with which the system uses computational resources (CPU, memory, network, I/O) to accomplish its work. Performance is about resource utilization efficiency, distinct from responsiveness (which is about perceived speed).

**Key metrics**
- Throughput (requests per second at given resource budget)
- Memory allocation rate / GC pressure (Go)
- CPU utilization under nominal and peak load
- Database query execution time
- Goroutine count under load

**Tactics**
- Avoid unnecessary memory allocations in hot paths (reuse buffers, prefer stack allocation)
- Use `sync.Pool` for frequently allocated short-lived objects
- Profile before optimizing — use `pprof` to identify actual bottlenecks
- Batch database/upstream calls where possible instead of N+1 patterns
- Keep JSON marshaling structs lean — avoid large embedded structs in responses

**Trade-offs**
- Micro-optimizations improve performance but reduce readability and maintainability
- Connection pooling improves throughput but adds connection management complexity

**In this project**
- HTTP clients must be initialized once and reused (connection pool) — never create `http.Client` per request
- Response structs should include only the fields required by the contract

---

## Security

**Description**
The degree to which the system protects data and operations from unauthorized access, modification, disclosure, or destruction — across the full request lifecycle.

**Key metrics**
- Number of open vulnerabilities (SAST/dependency scan)
- Time to patch critical CVEs
- Authentication/authorization failure rate
- PII exposure incidents

**Tactics**
- Validate all input at system boundaries using strongly typed structs with explicit constraints
- Never expose PII, secrets, tokens, or stack traces in logs, error messages, or responses
- Use MercadoLibre's authorization SDK for all identity and permission checks
- Apply principle of least privilege — services request only the scopes they need
- Use parameterized queries / ORM abstractions — never concatenate user input into queries
- Never hardcode credentials; use Fury Secrets Service for injection

**Trade-offs**
- Strict input validation adds latency to the request path but prevents injection attacks
- Defense-in-depth (multiple security layers) adds complexity but reduces blast radius of breaches

**In this project**
- Security rules defined in `.claude/rules/go/go-security-patterns-rules_v1.md` must be applied to all code
- CORS, security headers, and rate limiting are managed centrally by Fury — do not configure at app level
