# MCP Tools Implementation Plan — <project_name>

## Knowledge Base Coverage

The `<knowledge_base_dir>/` knowledge base covers <N> domains:

| Domain | Files |
|--------|-------|
| <domain_1> | `<file_1.md>`, `<file_2.md>` |
| <domain_2> | `<file_3.md>`, `<file_4.md>` |
| <domain_3> | `<file_5.md>` |

---

## Recommended Tools — <N> Total

### P0 — Core Productivity Loop

#### 1. `<tool_name>`

<One-sentence description of what the tool generates or does.>

| Input | Type | Description |
|-------|------|-------------|
| `<param_1>` | string | <description> |
| `<param_2>` | string | <description, e.g. snake_case> |
| `<param_3>` | enum | <allowed values> |
| `<param_4>` | array | Optional — <description> |

**Knowledge base:** `<file_1.md>`, `<file_2.md>`
**Service:** `internal/services/<service_file>.go`
**Complexity:** High / Medium / Low — <brief reason>

---

#### 2. `<tool_name>`

<One-sentence description.>

| Input | Type | Description |
|-------|------|-------------|
| `<param_1>` | string | <description> |
| `<param_2>` | string | <description> |
| `<param_3>` | array | Defaults to <default> |

**Knowledge base:** `<file_1.md>`, `<file_2.md>`
**Service:** `internal/services/<service_file>.go`
**Complexity:** High / Medium / Low — <brief reason>

---

#### 3. `<tool_name>`

<One-sentence description.>

| Input | Type | Description |
|-------|------|-------------|
| `<param_1>` | string | <description> |
| `<param_2>` | enum | <allowed values> |
| `<param_3>` | array | Subset of <N> sections (defaults to all) |

**Output:**
```json
{
  "<field_1>": false,
  "<field_2>": [
    {
      "name": "<section_name>",
      "passed": false,
      "findings": [
        {"line_hint": "<code snippet>", "issue": "<description>", "severity": "critical"}
      ]
    }
  ],
  "<field_3>": [
    {"pattern": "<code pattern>", "reason": "<description>"}
  ]
}
```

**Knowledge base:** `<file_1.md>`, `<file_2.md>`
**Service:** `internal/services/<service_file>.go`
**Complexity:** High / Medium / Low — <brief reason>

---

### P1 — High Value

#### 4. `<tool_name>`

<One-sentence description.>

| Input | Type | Description |
|-------|------|-------------|
| `<param_1>` | string | <description> |
| `<param_2>` | string | <description> |
| `<param_3>` | enum | <allowed values> |
| `<param_4>` | array | Optional `{name, type}` pairs |

**Knowledge base:** `<file_1.md>`, `<file_2.md>`
**Service:** `internal/services/<service_file>.go`
**Complexity:** High / Medium / Low — <brief reason>

---

#### 5. `<tool_name>`

<One-sentence description.>

| Input | Type | Description |
|-------|------|-------------|
| `<param_1>` | string | <description> |
| `<param_2>` | string | snake_case |
| `<param_3>` | int | <default value> |
| `<param_4>` | float | Default <value> |
| `<param_5>` | string | Optional — <description> |

**Knowledge base:** `<file_1.md>`, `<file_2.md>`
**Service:** `internal/services/<service_file>.go`
**Complexity:** High / Medium / Low — <brief reason>

---

#### 6. `<tool_name>`

<One-sentence description.>

| Input | Type | Description |
|-------|------|-------------|
| `<param_1>` | string | Free-text <description> |
| `<param_2>` | array | e.g. `["<hint_1>", "<hint_2>"]` |
| `<param_3>` | enum | <allowed values> |

**Knowledge base:** `<file_1.md>`, `<file_2.md>`, `<file_3.md>`
**Service:** `internal/services/<service_file>.go`
**Complexity:** High / Medium / Low — <brief reason>

---

### P2 — Reduces Common Friction

#### 7. `<tool_name>`

<One-sentence description.>

| Input | Type | Description |
|-------|------|-------------|
| `<param_1>` | string | <description> |
| `<param_2>` | array | Subset of <N> sections (defaults to all) |

**Knowledge base:** `<file_1.md>`, `<file_2.md>`
**Service:** `internal/services/<service_file>.go`
**Complexity:** High / Medium / Low — <brief reason>

---

#### 8. `<tool_name>`

<One-sentence description.>

| Input | Type | Description |
|-------|------|-------------|
| `<param_1>` | string | Natural language description |
| `<param_2>` | enum | <allowed values> |
| `<param_3>` | array | <description> |
| `<param_4>` | array | Known error conditions |
| `<param_5>` | int | P99 target, default <value> |

**Knowledge base:** `<file_1.md>`
**Service:** `internal/services/<service_file>.go`
**Complexity:** High / Medium / Low — <brief reason>

---

## Implementation Order

```
Phase 1 — Foundation (implement in parallel)
  <tool_name_1>     → internal/services/<file_1>.go
  <tool_name_2>     → internal/services/<file_2>.go
  <tool_name_3>     → internal/services/<file_3>.go

Phase 2 — Extend (implement in parallel)
  <tool_name_4>     → internal/services/<file_4>.go
  <tool_name_5>     → internal/services/<file_5>.go
  <tool_name_6>     → internal/services/<file_6>.go

Phase 3 — Frontend & Docs (implement in parallel)
  <tool_name_7>     → internal/services/<file_7>.go
  <tool_name_8>     → internal/services/<file_8>.go
```

---

## Complexity Summary

| Tool | Priority | Complexity | Templates / Checks |
|------|----------|-----------|-------------------|
| `<tool_name_1>` | P0 | High | <N> file templates |
| `<tool_name_2>` | P0 | Medium | <N> file templates |
| `<tool_name_3>` | P0 | Medium | <N>-section checklist |
| `<tool_name_4>` | P1 | High | <N> file templates |
| `<tool_name_5>` | P1 | Medium | <N> files + <N> monitor JSON |
| `<tool_name_6>` | P1 | Medium | <N> catalogs, scoring |
| `<tool_name_7>` | P2 | Low-Med | <N>-section checklist |
| `<tool_name_8>` | P2 | Low-Med | <N> template, <N> sections |

---

## Key Architectural Decisions

**<Decision title>.** <Explanation of the decision and its rationale.>

**<Decision title>.** <Explanation. Reference specific dirs or patterns if relevant.>

**<Decision title>.** <Explanation.>

**<Decision title>** follows the established pattern:
```go
<code example>
```

## Critical Reference Files

| File | Purpose |
|------|---------|
| `<path/to/file_1>` | <purpose> |
| `<path/to/file_2>` | <purpose> |
| `<path/to/file_3>` | <purpose> |
| `<path/to/file_4>` | <purpose> |
