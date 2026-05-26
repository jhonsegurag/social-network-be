# Architecture Catalog

> Reference catalog of system architecture styles. For each: name, description, when to use, and applicability to this project.

---

## Monolith

**Description**
A single deployable unit where all components — UI, business logic, data access — are compiled and deployed together. All modules share the same process, memory space, and deployment lifecycle.

**Variants**
- **Modular monolith**: Internally decomposed into well-defined modules with clear boundaries, but still deployed as one unit. Best of both worlds for early-stage systems.
- **Layered monolith**: Code organized into horizontal layers (presentation → business logic → data access) without feature-based decomposition.

**Characteristics**

| Attribute | Monolith |
|-----------|----------|
| Deployment unit | Single binary / artifact |
| Scaling | Vertical or all-at-once horizontal |
| Communication | In-process function calls (no network hop) |
| Consistency | Strong (single DB transaction) |
| Operational complexity | Low |
| Development speed (early) | High |

**When to use**
- Early-stage product where requirements are still evolving
- Small team (< 5 engineers) working on a bounded domain
- Low traffic — vertical scaling is sufficient for the foreseeable future
- The overhead of distributed systems (network, serialization, observability) outweighs the benefits

**When NOT to use**
- Independent scaling of components is required
- Multiple teams need to deploy their work independently
- Technology heterogeneity is needed across domains

**Applicability to this project**
This service (`{app_name}`) is deployed as a single Go binary on Platform PaaS. It is effectively a modular monolith within the omnichannel bounded context. New features are added as POD vertical slices within the same binary — not as separate services.

---

## Microservices

**Description**
The application is decomposed into small, independently deployable services, each owning a specific business capability. Services communicate over the network (HTTP, gRPC, message queues) and have independent data stores.

**Characteristics**

| Attribute | Microservices |
|-----------|--------------|
| Deployment unit | One per service |
| Scaling | Independent per service |
| Communication | Network (HTTP/gRPC/messaging) |
| Consistency | Eventual (distributed transactions via Saga/outbox) |
| Operational complexity | High |
| Development speed (early) | Low (infra overhead) |

**When to use**
- Large teams need independent release cadences (Conway's Law alignment)
- Dramatically different scaling requirements across capabilities (e.g., search vs. checkout)
- Polyglot persistence — different services use the best database for their domain
- Resilience isolation — one service failing should not take down the entire product

**When NOT to use**
- The team is small and domain boundaries are unclear — premature decomposition creates distributed monolith
- Network latency between services would violate latency SLOs
- The operational maturity (observability, service mesh, CI/CD per service) is not in place

**Applicability to this project**
This service is itself a microservice within SpyriaIT's broader platform. It consumes data from upstream services (orders, shipping, buyers) via their public APIs. Within this service's boundary, use POD modular structure — do not create separate deployable services for individual features.

**Decomposition heuristics**
- Decompose by business capability, not by technical layer
- Each service should own its data — shared databases between services are a smell
- Apply the "two-pizza team" rule: if a team can't be fed by two pizzas, the service is too large

---

## Layered Architecture

**Description**
Code is organized into horizontal layers where each layer may only depend on the layer directly below it. The classic form has: Presentation → Business Logic → Data Access → Database. Requests flow top-down; responses flow bottom-up.

**Variants**

| Variant | Description |
|---------|-------------|
| Classic 3-tier | Presentation / Business / Data |
| Hexagonal (Ports & Adapters) | Core domain + inbound/outbound ports + adapters |
| Clean Architecture | Entities / Use Cases / Interface Adapters / Frameworks |
| Onion Architecture | Domain core surrounded by application/infra rings |

**Characteristics**

| Attribute | Layered |
|-----------|---------|
| Coupling | Unidirectional (top depends on bottom) |
| Testability | Good — each layer testable in isolation via interfaces |
| Domain isolation | Depends on variant — Hexagonal/Clean protect domain from infra |
| Cognitive load | Low — clear mental model for new contributors |

**When to use**
- Backend services with well-defined request-response flows
- Teams prioritizing testability and separation of concerns
- When domain logic must be isolated from infrastructure details (DB choice, HTTP framework)

**When NOT to use**
- Event-driven pipelines where "layers" don't map to request-response — use pipeline or actor model instead
- Performance-critical paths where the abstraction overhead is measurable

**Applicability to this project**
This service uses **Hexagonal Architecture with POD decomposition**:

```
Inbound adapters   → cmd/api/routes/handlers/
Core domain        → internal/core/domain/
Port interfaces    → internal/core/port/
Use cases          → internal/core/usecase/
Orchestrators      → internal/core/orchestrator/
Outbound adapters  → internal/platform/repository/
```

Each layer imports only its designated dependencies (see `reference_architecture_template.mdc`). The domain and port layers are completely independent of the HTTP framework and database drivers.
