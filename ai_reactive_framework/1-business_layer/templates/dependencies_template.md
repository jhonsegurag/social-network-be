# Dependencies — <project_name>

## External Dependencies

### Private Registry (`<registry_url>`)

| Package | Alias / Import Path | Version | Purpose |
|---------|---------------------|---------|---------|
| `<package_1>` | `<import_path>` | latest | <purpose> |
| `<package_2>` | `<import_path>` | latest | <purpose> |

### Public Registry

| Package | Import Path | Version | Purpose |
|---------|-------------|---------|---------|
| `<package_1>` | `<import_path>` | `<version>` | <purpose> |
| `<package_2>` | `<import_path>` | `<version>` | <purpose> |
| `<package_3>` | `<import_path>` | `<version>` | <purpose> |

### Migration API Endpoints

| API | Old Base URL | New Base URL | Path Pattern | Routing Config |
|-----|-------------|-------------|--------------|----------------|
| `<api_name_1>` | `<old_base_url>` | `<new_base_url>` | `<path_pattern>` | `<routing_config_id>` |
| `<api_name_2>` | `<old_base_url>` | `<new_base_url>` | `<path_pattern>` | `<routing_config_id>` |

---

## Internal Dependencies

### Tool → Service Mapping

| Tool | Service File | Description |
|------|-------------|-------------|
| `<tool_name_1>` | `internal/services/<file_1>.go` | <what the service does> |
| `<tool_name_2>` | `internal/services/<file_2>.go` | <what the service does> |
| `<tool_name_3>` | `internal/services/<file_3>.go` | <what the service does> |
| `<tool_name_4>` | `internal/services/<file_4>.go` | <what the service does> |
| `<tool_name_5>` | `internal/services/<file_5>.go` | <what the service does> |
| `<tool_name_6>` | `internal/services/<file_6>.go` | <what the service does> |
| `<tool_name_7>` | `internal/services/<file_7>.go` | <what the service does> |
| `<tool_name_8>` | `internal/services/<file_8>.go` | <what the service does> |

### Tool → Knowledge Base Mapping

| Tool | Knowledge Base Files |
|------|---------------------|
| `<tool_name_1>` | `<kb_file_1.md>`, `<kb_file_2.md>`, `<kb_file_3.md>` |
| `<tool_name_2>` | `<kb_file_1.md>`, `<kb_file_2.md>` |
| `<tool_name_3>` | `<kb_file_1.md>`, `<kb_file_2.md>`, `<kb_file_3.md>` |
| `<tool_name_4>` | `<kb_file_1.md>`, `<kb_file_2.md>` |
| `<tool_name_5>` | `<kb_file_1.md>`, `<kb_file_2.md>` |
| `<tool_name_6>` | `<kb_file_1.md>`, `<kb_file_2.md>`, `<kb_file_3.md>`, `<kb_file_4.md>` |
| `<tool_name_7>` | `<kb_file_1.md>`, `<kb_file_2.md>`, `<kb_file_3.md>` |
| `<tool_name_8>` | `<kb_file_1.md>` |

### Tool → Template Files Mapping

| Tool | Template Directory | Files |
|------|--------------------|-------|
| `<tool_name_1>` | `internal/services/templates/<lang>/` | <N> templates |
| `<tool_name_2>` | `internal/services/templates/<lang>/` | <N> templates |
| `<tool_name_3>` | — | checklist only (no templates) |
| `<tool_name_4>` | `internal/services/templates/<lang>/` | <N> templates |
| `<tool_name_5>` | `internal/services/templates/<lang>/` | <N> templates + <N> JSON blocks |
| `<tool_name_6>` | — | catalog scoring only (no templates) |
| `<tool_name_7>` | — | checklist only (no templates) |
| `<tool_name_8>` | `internal/services/templates/` | <N> template |

---

## Shared Infrastructure Dependencies

### DI Wiring

All tools are registered in `cmd/api/main.go`. Adding a new tool requires:
1. Instantiate the service: `<toolSvc> := services.New<ToolName>Service()`
2. Register the tool: `mcpServer.RegisterTool(<tool_pkg>.New(<toolSvc>))`

### Metrics Middleware

All tools automatically inherit metrics via `MCPServer.withMetrics` in `internal/server/mcp.go`.
No per-tool instrumentation needed.

### Shared Utilities

| Utility | Path | Used By |
|---------|------|---------|
| `utils.Bool` | `internal/utils/ptr.go` | All tools (Annotations) |
| `<utility_2>` | `internal/utils/<file>.go` | <tools or services> |

---

## Knowledge Base Directory

| Domain | Directory | Files |
|--------|-----------|-------|
| `<domain_1>` | `<kb_dir>/` | `<file_1.md>`, `<file_2.md>`, `<file_3.md>` |
| `<domain_2>` | `<kb_dir>/` | `<file_1.md>`, `<file_2.md>` |
| `<domain_3>` | `<kb_dir>/` | `<file_1.md>` |
| `<domain_4>` | `<kb_dir>/` | `<file_1.md>`, `<file_2.md>` |
| `<domain_5>` | `<kb_dir>/` | `<file_1.md>`, `<file_2.md>` |
| `<domain_6>` | `<kb_dir>/` | `<file_1.md>`, `<file_2.md>`, `<file_3.md>`, `<file_4.md>` |

---

## Constraints

- **No external HTTP calls at runtime.** All tools are stateless and offline-capable. All logic is derived from embedded knowledge base content.
- **Private registry access required at build time.** `GOPRIVATE=<private_module_patterns>` must be set.
- **Platform compatibility.** All dependencies must be compatible with `<platform>` runtime constraints.
