---
description: Feature business specification template — objectives, user stories, acceptance criteria, business rules, and error cases. Copy and fill one file per feature.
globs:
alwaysApply: false
---

# Business Specification — [Feature Name]

> **Instructions**: Replace every `[placeholder]` with feature-specific content.
> One file per feature. Store under `1-business_layer/<feature>/business_rules.mdc`.

---

## 1. Objective

[One-paragraph description of what this feature does and why it exists.
Include the business problem it solves and the user or system it serves.]

---

## 2. Scope

| In scope | Out of scope |
|----------|-------------|
| [What is included] | [What is explicitly excluded] |

---

## 3. Actors

| Actor | Description |
|-------|-------------|
| [Actor 1] | [Role in this feature] |
| [Actor 2] | [Role in this feature] |

---

## 4. User Stories

```
AS A [actor]
I WANT TO [action]
SO THAT [business value]
```

### Story 1 — [Short title]

**Given** [precondition]
**When** [trigger / action]
**Then** [expected outcome]

### Story 2 — [Short title]

**Given** [precondition]
**When** [trigger / action]
**Then** [expected outcome]

---

## 5. Acceptance Criteria

- [ ] [Criterion 1 — measurable and testable]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

---

## 6. API Contract

### Endpoint

```
[HTTP_METHOD] /[resource-path]
```

### Request

```json
{
  "[field]": "[type — description]"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `[field]` | `string` | Yes | [rule] |

### Response — 200 OK

```json
{
  "[field]": "[type — description]"
}
```

### Response — Error

```json
{
  "message": "human-readable message",
  "error": "error_type_key",
  "status": 404
}
```

---

## 7. Business Rules

| # | Rule | Rationale |
|---|------|-----------|
| BR-01 | [Rule statement] | [Why this rule exists] |
| BR-02 | [Rule statement] | [Why this rule exists] |

---

## 8. State Transitions

> Only required for features that manage entity state.

```
[Initial State] ──[trigger]──► [Next State] ──[trigger]──► [Final State]
```

| From | Trigger | To | Guard condition |
|------|---------|-----|----------------|
| [state] | [event] | [state] | [condition] |

---

## 9. Error Cases

| Scenario | Error Type | HTTP Status | Message |
|----------|-----------|-------------|---------|
| Resource not found | `not_found_error` | 404 | [message] |
| Invalid input | `bad_request_error` | 400 | [message] |
| Unauthorized | `unauthorized_error` | 401 | [message] |
| Forbidden | `forbidden_error` | 403 | [message] |
| Upstream failure | `failed_dependency_error` | 424 | [message] |
| Unexpected failure | `internal_server_error` | 500 | [message] |

---

## 10. Non-Functional Requirements

| Attribute | Target |
|-----------|--------|
| Latency (p99) | [e.g., < 500 ms] |
| Availability | [e.g., 99.9%] |
| Throughput | [e.g., 500 rps] |
| Data sensitivity | [PII / Non-PII] |

---

## 11. Dependencies

| System | Type | Purpose |
|--------|------|---------|
| [Service name] | HTTP / gRPC / DB | [What data/operation is needed] |

---

## 12. Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| OQ-01 | [Question] | [Name] | [Date] |
