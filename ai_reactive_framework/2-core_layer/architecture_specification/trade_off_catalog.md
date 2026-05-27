# Trade-Off Catalog

> Reference catalog of the most common architectural trade-offs. Use when writing ADRs or evaluating design alternatives for a feature. Each entry states the tension, the forcing factors on each side, and the recommended default for this project.

---

## Performance vs Maintainability

**Tension**
Optimizing for raw performance often requires low-level techniques (manual memory management, unsafe operations, inlining logic, skipping abstractions) that make code harder to read, test, and evolve. Maintainable code — clear abstractions, separation of concerns, named interfaces — introduces indirection that has a measurable cost.

**Favor Performance when**
- The endpoint is on the critical path with a hard latency SLO (e.g., < 100 ms P99)
- Profiling (`pprof`) proves the abstraction is a real bottleneck, not a theoretical one
- The optimization is localized to a single function and well-documented

**Favor Maintainability when**
- The service handles < 500 rps and latency SLO is relaxed (> 200 ms P99)
- The code is likely to change frequently (feature-heavy domain logic)
- The team is growing — readability reduces onboarding cost

**Recommended default for this project**
Prefer maintainability. Apply the POD layer separation and named port interfaces as the baseline. Only optimize after profiling identifies a concrete bottleneck in production. Document every performance optimization with a comment explaining why the normal pattern was bypassed.

**Warning signs of the wrong choice**
- Inlining business logic into repository adapters for "speed" without a measured SLO breach
- Removing interface layers because "it's just one feature" — this breaks testability

---

## Performance vs Security

**Tension**
Security controls add overhead: input validation, authorization checks, encryption, and audit logging all consume CPU and add latency. Removing or shortcutting them improves throughput but opens attack surfaces.

**Favor Performance when**
- The endpoint is on a trusted internal network with mutual TLS already established at the infrastructure layer
- The security check has been measured (not assumed) to be the bottleneck
- An equivalent control exists at a higher layer (API gateway, service mesh)

**Favor Security when**
- The endpoint is exposed to external traffic or accepts user-provided data
- The data handled includes PII, financial transactions, or credentials
- A compliance requirement mandates the control regardless of cost

**Recommended default for this project**
Always apply security controls as defined in `go-security-patterns-rules_v1.md`. Never skip input validation or authorization checks for performance reasons. If a control is genuinely redundant (covered at infra layer), document the justification explicitly in the code and in the ADR.

**Warning signs of the wrong choice**
- Removing `validate.Struct()` calls because "the API gateway already validates"
- Passing raw query params to `http.Get` to avoid an allowlist check

---

## Scalability vs Consistency

**Tension**
Distributing load across multiple instances (horizontal scaling) improves throughput and fault tolerance. However, distributed state introduces consistency challenges: two instances may serve stale data, process the same event twice, or produce conflicting writes if not carefully coordinated.

**Favor Scalability when**
- The use case tolerates eventual consistency (e.g., read-heavy reporting views, product catalogs)
- The business impact of serving slightly stale data is low
- The upstream system is the system of record and the service is a read-through cache

**Favor Consistency when**
- The operation mutates shared state (inventory counts, financial balances, order status)
- Double-processing the same event would cause business harm (duplicate charges, duplicate shipments)
- Regulatory requirements mandate strong consistency

**Recommended default for this project**
This service is currently read-heavy (omnichannel view aggregation). Design for eventual consistency with clear cache TTLs. When write operations are added, evaluate whether idempotency keys and deduplication are required before scaling out.

**Warning signs of the wrong choice**
- Adding in-memory caches without TTL in a horizontally scaled service
- Assuming a request is processed exactly once without idempotency checks on POST/PUT endpoints

---

## Availability vs Consistency (CAP Trade-off)

**Tension**
In a distributed system under network partition, a service must choose between continuing to serve (possibly stale) responses (availability) or refusing to serve until it can guarantee a consistent view (consistency). This is the CAP theorem partition case.

**Favor Availability when**
- The operation is read-only and returning slightly stale data is acceptable
- Downtime is more damaging to the business than a brief inconsistency window
- A fallback (cached response, default value) is semantically valid for the use case

**Favor Consistency when**
- The response drives an irreversible action (payment capture, shipment dispatch)
- The caller makes a business decision based on the returned value that cannot be undone
- Serving stale data would expose the business to fraud or compliance risk

**Recommended default for this project**
Prefer availability with a defined staleness bound. Use cache TTLs as the consistency contract. Document the maximum acceptable staleness for each cached resource in the feature's business spec. For any future write operations, default to consistency and require explicit team sign-off to relax it.

**Warning signs of the wrong choice**
- Returning cached order status to a logistics system making a dispatch decision
- Refusing to serve any response during a non-critical upstream degradation (over-prioritizing consistency)
