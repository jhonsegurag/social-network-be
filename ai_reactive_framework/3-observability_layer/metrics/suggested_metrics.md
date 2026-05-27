# Suggested Metrics

> Quick reference for the metrics that should be instrumented for every feature. Companion to `suggested-monitors.mdc` which contains the full OTel/Datadog implementation details.

---

## Minimum Required Metrics per Feature

Every new feature **must** instrument the following metrics before going to production:

| Metric | Type | Layer | Description |
|--------|------|-------|-------------|
| `<svc>.<feat>.http.requests_total` | Counter | Handler | Total inbound HTTP requests |
| `<svc>.<feat>.http.errors_total` | Counter | Handler | HTTP error responses (4xx/5xx) |
| `<svc>.<feat>.http.latency_ms` | Histogram | Handler | End-to-end request duration |
| `<svc>.<feat>.usecase.calls_total` | Counter | UseCase | Total use case invocations |
| `<svc>.<feat>.usecase.errors_total` | Counter | UseCase | Use case errors by type |
| `<svc>.<feat>.repository.calls_total` | Counter | Repository | Total repository calls |
| `<svc>.<feat>.repository.errors_total` | Counter | Repository | Repository errors |
| `<svc>.<feat>.repository.latency_ms` | Histogram | Repository | Data access duration |

---

## Naming Convention

```
{app_name}.<feature>.<operation>.<unit>
```

Examples:
```
{app_name}.rows.http.requests_total
{app_name}.rows.repository.latency_ms
{app_name}.orders.usecase.errors_total
```

---

## Required Labels

| Label | Values | Required on |
|-------|--------|-------------|
| `feature` | `rows`, `orders`, … | All metrics |
| `operation` | `get_rows`, `create_order`, … | All metrics |
| `status` | `success` / `error` | All metrics |
| `error_type` | `not_found_error`, `internal_server_error`, … | Error counters only |
| `layer` | `handler`, `usecase`, `repository` | All metrics |

---

## Histogram Buckets (Latency)

```
5ms, 10ms, 25ms, 50ms, 100ms, 200ms, 500ms, 1000ms, 2500ms, 5000ms
```

Adjust based on the SLO for the feature. For fast internal APIs, tighten the lower buckets. For slow upstream calls, add buckets above 5000ms.

---

## Business Metrics (Optional but Recommended)

Beyond technical metrics, instrument business-level signals:

| Metric | Type | Description |
|--------|------|-------------|
| `{app_name}.<feat>.items_processed_total` | Counter | Total business entities processed |
| `{app_name}.<feat>.cache_hits_total` | Counter | Cache hits (if caching is used) |
| `{app_name}.<feat>.cache_misses_total` | Counter | Cache misses |
| `{app_name}.<feat>.upstream_calls_total` | Counter | Calls to external services |

---

## SLO Targets (Default)

| SLI | Metric | Default Target |
|-----|--------|---------------|
| Availability | `1 - (http.errors_total / http.requests_total)` | ≥ 99.9% |
| Latency | `p99(http.latency_ms)` | ≤ 500 ms |
| Repository success | `1 - (repository.errors_total / repository.calls_total)` | ≥ 99.5% |

Override these defaults in the feature's business spec if the SLO is different.

---

## Suggested Monitors (Summary)

For full Datadog monitor queries see `metrics/suggested-monitors.mdc`. The minimum set per feature:

1. **High error rate** — alert when `errors_total / requests_total > 5%` over 5 minutes
2. **High P99 latency** — alert when `p99(http.latency_ms) > [SLO threshold]`
3. **No traffic** — alert when `requests_total < 1` over 10 minutes
4. **Repository errors** — alert when `repository.errors_total > 10` over 5 minutes

---

## Implementation Reference

- Full OTel metric implementation: `3-observability_layer/metrics/suggested-monitors.mdc`
- Go metric struct template: see `Metrics` struct in `suggested-monitors.mdc` section 5
- Datadog monitor JSON templates: see `suggested-monitors.mdc` section 6
