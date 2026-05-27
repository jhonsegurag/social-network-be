# Development Lifecycle Flow — rf_ Commands

## Overview

Automated development lifecycle using 4 phases and `rf_` prefixed commands.
Features originate from `ai_reactive_framework/context/1-plan.md` and progress
through the flow via Claude Code custom commands.

---

## The Flow

```
ai_reactive_framework/context/
  0-context.md   ← Project architecture (MCP server)
  1-plan.md      ← 8 planned tools (source for rf_to_do)
        │
        │  rf_to_do <feature>
        ▼
flow/1-to_do/<feature>.md      ← full 12-section business spec (generated)
        │
        │  rf_wip <feature>
        ▼
flow/2-wip/<feature>.md        ← active development
        │
        │  rf_review <feature>
        ▼
flow/3-to_review/<feature>.md  ← ready for code review
        │
        │  rf_done <feature>
        ▼
flow/4-done/<feature>.md       ← completed
```

---

## Commands

| Command | Input | Action |
|---------|-------|--------|
| `rf_to_do <feature>` | feature name | Reads definition from `context/1-plan.md` → generates 12-section business spec → writes `flow/1-to_do/<feature>.md` |
| `rf_wip <feature>` | feature name | Moves `flow/1-to_do/<feature>.md` → `flow/2-wip/<feature>.md` |
| `rf_review <feature>` | feature name | Moves `flow/2-wip/<feature>.md` → `flow/3-to_review/<feature>.md` |
| `rf_done <feature>` | feature name | Moves `flow/3-to_review/<feature>.md` → `flow/4-done/<feature>.md` |

---

## How `rf_to_do` Works

The 8 planned tools in `context/1-plan.md` are the features. Each entry contains
enough information to generate a full 12-section business spec.

```
context/1-plan.md  →  entry for <feature>
  name, description, inputs, knowledge base files, complexity
        │
        ▼  rf_to_do <feature>
        │
  Apply 1-business_layer/templates/business_rules_template.md (12 sections):
     § 1  Objective          ← from tool description + purpose
     § 2  Scope              ← what it generates vs what is excluded
     § 3  Actors             ← MCP client (Claude/Cursor), Developer
     § 4  User Stories       ← Given/When/Then per input scenario
     § 5  Acceptance Criteria ← per tool contract and output shape
     § 6  API Contract       ← MCP tool interface (inputs + output schema)
     § 7  Business Rules     ← constraints: stateless, read-only, embed.FS
     § 8  State Transitions  ← skip (stateless tool)
     § 9  Error Cases        ← invalid input, template render fail, etc.
     §10  NFRs               ← latency + availability from context/0-context.md
     §11  Dependencies       ← knowledge base files listed in the plan entry
     §12  Open Questions     ← scaffolded empty
        │
        ▼
  flow/1-to_do/<feature>.md
```

---

## Available Features

Source: `context/1-plan.md`

| Feature | Priority | Complexity |
|---------|----------|-----------|
| `scaffold_go_feature` | P0 | High |
| `scaffold_test_suite` | P0 | Medium |
| `evaluate_backend_code` | P0 | Medium |
| `scaffold_java_feature` | P1 | High |
| `generate_observability` | P1 | Medium |
| `recommend_architecture_pattern` | P1 | Medium |
| `evaluate_frontend_code` | P2 | Low-Med |
| `generate_business_spec` | P2 | Low-Med |

---

## Implementation — Claude Code Commands

Commands live as Claude Code custom command files:

```
.claude/
  commands/
    rf_to_do.md      ← generation: context/1-plan.md → business spec → flow/1-to_do/
    rf_wip.md        ← move: flow/1-to_do/ → flow/2-wip/
    rf_review.md     ← move: flow/2-wip/ → flow/3-to_review/
    rf_done.md       ← move: flow/3-to_review/ → flow/4-done/
```

---

## Example Session

```bash
# Generate the business spec for the first P0 tool
/rf_to_do scaffold_go_feature
# → reads context/1-plan.md entry for scaffold_go_feature
# → applies business_rules_template.md
# → creates flow/1-to_do/scaffold_go_feature.md

# Start development
/rf_wip scaffold_go_feature
# → moves to flow/2-wip/scaffold_go_feature.md

# Done coding, request review
/rf_review scaffold_go_feature
# → moves to flow/3-to_review/scaffold_go_feature.md

# Review passed
/rf_done scaffold_go_feature
# → moves to flow/4-done/scaffold_go_feature.md
```

---

## Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| OQ-01 | Should `rf_wip/rf_review/rf_done` **move** the file (delete from previous phase) or **copy** it? | — | — |
| OQ-02 | Should `rf_to_do` also support ad-hoc feature files added directly to `context/` beyond `1-plan.md`? | — | — |
