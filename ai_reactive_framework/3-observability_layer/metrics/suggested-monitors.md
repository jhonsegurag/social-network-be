---
description: OTel/Datadog metrics template — metric naming conventions, label taxonomy, histogram buckets, and suggested monitors per feature for {app_name}.
globs:
alwaysApply: false
---

# Observability — Metrics & Monitors Template

## Stack

| Component | Technology |
|-----------|-----------|
| Metrics SDK | `go.opentelemetry.io/otel/metric` v1.41.0 |
| Backend | Datadog (via OTel collector on Platform PaaS) |
| Tracing | OpenTelemetry (propagated through `r.Context()`) |

---

## 1. Metric Naming Convention

```
<service>.<feature>.<operation>.<unit>
```

| Segment | Rule | Example |
|---------|------|---------|
| `<service>` | Fixed prefix = `{app_name}` | `{app_name}` |
| `<feature>` | Snake-case feature name | `rows`, `orders`, `shipments` |
| `<operation>` | Verb or noun describing what was measured | `requests`, `errors`, `latency`, `cache_hits` |
| `<unit>` | Omit for counts; append `_ms`, `_bytes`, `_total` | `latency_ms`, `requests_total` |

### Examples

```
{app_name}.rows.requests_total
{app_name}.rows.errors_total
{app_name}.rows.latency_ms
{app_name}.rows.repository.latency_ms
{app_name}.rows.repository.errors_total
```

---

## 2. Label (Attribute) Taxonomy

Always attach these labels to every metric:

| Label | Values | Description |
|-------|--------|-------------|
| `feature` | `rows`, `[feature_name]` | Which feature emitted this metric |
| `operation` | `get_rows`, `create_order`, … | Which operation was executed |
| `status` | `success`, `error` | Outcome of the operation |
| `error_type` | `not_found_error`, `internal_server_error`, … | Only on error metrics; matches usecase ErrorType string |
| `layer` | `handler`, `usecase`, `repository` | Where the metric was recorded |

```go
import "go.opentelemetry.io/otel/attribute"

attrs := []attribute.KeyValue{
    attribute.String("feature",    "rows"),
    attribute.String("operation",  "get_rows"),
    attribute.String("status",     "success"),
    attribute.String("layer",      "usecase"),
}
```

---

## 3. Metric Types & Instruments

### Request Counter

```go
import (
    "go.opentelemetry.io/otel/metric"
)

// Initialize once (e.g., in service constructor)
requestCounter, _ := meter.Int64Counter(
    "{app_name}.rows.requests_total",
    metric.WithDescription("Total number of rows requests"),
    metric.WithUnit("{request}"),
)

// Record on each call
requestCounter.Add(ctx, 1,
    metric.WithAttributes(
        attribute.String("feature",   "rows"),
        attribute.String("operation", "get_rows"),
        attribute.String("status",    "success"),
    ),
)
```

### Error Counter

```go
errorCounter, _ := meter.Int64Counter(
    "{app_name}.rows.errors_total",
    metric.WithDescription("Total number of rows errors"),
    metric.WithUnit("{error}"),
)

errorCounter.Add(ctx, 1,
    metric.WithAttributes(
        attribute.String("feature",    "rows"),
        attribute.String("operation",  "get_rows"),
        attribute.String("error_type", ucErr.Type.String()),
        attribute.String("layer",      "usecase"),
    ),
)
```

### Latency Histogram

```go
latencyHistogram, _ := meter.Float64Histogram(
    "{app_name}.rows.latency_ms",
    metric.WithDescription("Rows operation latency in milliseconds"),
    metric.WithUnit("ms"),
    metric.WithExplicitBucketBoundaries(
        // Suggested buckets — adjust per SLO
        5, 10, 25, 50, 100, 200, 500, 1000, 2500, 5000,
    ),
)

start := time.Now()
// ... operation ...
latencyHistogram.Record(ctx,
    float64(time.Since(start).Milliseconds()),
    metric.WithAttributes(
        attribute.String("feature",   "rows"),
        attribute.String("operation", "get_rows"),
        attribute.String("status",    "success"),
    ),
)
```

---

## 4. Metrics by Layer

### Handler Layer

| Metric | Type | When to record |
|--------|------|---------------|
| `<svc>.<feat>.http.requests_total` | Counter | Every inbound HTTP request |
| `<svc>.<feat>.http.errors_total` | Counter | Every HTTP error response (4xx/5xx) |
| `<svc>.<feat>.http.latency_ms` | Histogram | Request duration from handler entry to response write |

Labels: `feature`, `operation`, `status` (`success`/`error`), `http_status` (200, 404, 500…)

### UseCase Layer

| Metric | Type | When to record |
|--------|------|---------------|
| `<svc>.<feat>.usecase.calls_total` | Counter | Every usecase invocation |
| `<svc>.<feat>.usecase.errors_total` | Counter | Every usecase error returned |
| `<svc>.<feat>.usecase.latency_ms` | Histogram | UseCase execution duration |

### Repository Layer

| Metric | Type | When to record |
|--------|------|---------------|
| `<svc>.<feat>.repository.calls_total` | Counter | Every repository call |
| `<svc>.<feat>.repository.errors_total` | Counter | Every repository error |
| `<svc>.<feat>.repository.latency_ms` | Histogram | Time spent in data access |

---

## 5. Feature Metrics Template

Copy this block and fill in `[feature]` and `[operation]` for each new feature:

```go
// internal/platform/metrics/<feature>/metrics.go
package metrics

import (
    "context"
    "time"

    "go.opentelemetry.io/otel/attribute"
    "go.opentelemetry.io/otel/metric"
)

const featureName = "[feature]"

type Metrics struct {
    requestsTotal  metric.Int64Counter
    errorsTotal    metric.Int64Counter
    latencyMs      metric.Float64Histogram
}

func New(meter metric.Meter) (*Metrics, error) {
    prefix := "{app_name}." + featureName

    requestsTotal, err := meter.Int64Counter(prefix+".requests_total",
        metric.WithDescription("Total [feature] requests"))
    if err != nil {
        return nil, err
    }

    errorsTotal, err := meter.Int64Counter(prefix+".errors_total",
        metric.WithDescription("Total [feature] errors"))
    if err != nil {
        return nil, err
    }

    latencyMs, err := meter.Float64Histogram(prefix+".latency_ms",
        metric.WithDescription("[Feature] operation latency in milliseconds"),
        metric.WithUnit("ms"),
        metric.WithExplicitBucketBoundaries(5, 10, 25, 50, 100, 200, 500, 1000, 2500, 5000))
    if err != nil {
        return nil, err
    }

    return &Metrics{requestsTotal: requestsTotal, errorsTotal: errorsTotal, latencyMs: latencyMs}, nil
}

func (m *Metrics) RecordRequest(ctx context.Context, operation, status string) {
    m.requestsTotal.Add(ctx, 1, metric.WithAttributes(
        attribute.String("feature",   featureName),
        attribute.String("operation", operation),
        attribute.String("status",    status),
    ))
}

func (m *Metrics) RecordError(ctx context.Context, operation, errorType string) {
    m.errorsTotal.Add(ctx, 1, metric.WithAttributes(
        attribute.String("feature",    featureName),
        attribute.String("operation",  operation),
        attribute.String("error_type", errorType),
    ))
}

func (m *Metrics) RecordLatency(ctx context.Context, operation, status string, start time.Time) {
    m.latencyMs.Record(ctx, float64(time.Since(start).Milliseconds()),
        metric.WithAttributes(
            attribute.String("feature",   featureName),
            attribute.String("operation", operation),
            attribute.String("status",    status),
        ))
}
```

---

## 6. Suggested Monitors (Datadog)

For each feature, create the following monitors. Replace `[feature]` and tune thresholds to the SLO.

### 6.1 High Error Rate

```
name:    "[Feature] High Error Rate"
query:   sum(last_5m):sum:{app_name}.[feature].errors_total{*}.as_count()
         / sum:{app_name}.[feature].requests_total{*}.as_count() * 100 > 5
message: "Error rate for [feature] exceeded 5% over the last 5 minutes."
tags:    ["feature:[feature]", "team:cbt-sales", "severity:high"]
```

### 6.2 High P99 Latency

```
name:    "[Feature] High P99 Latency"
query:   p99(last_5m):avg:{app_name}.[feature].latency_ms{*} > [SLO_THRESHOLD_MS]
message: "P99 latency for [feature] exceeded [SLO_THRESHOLD_MS]ms."
tags:    ["feature:[feature]", "team:cbt-sales", "severity:high"]
```

### 6.3 Zero Requests (Anomaly)

```
name:    "[Feature] No Traffic Detected"
query:   sum(last_10m):sum:{app_name}.[feature].requests_total{*}.as_count() < 1
message: "No requests received for [feature] in the last 10 minutes. Possible outage or deploy issue."
tags:    ["feature:[feature]", "team:cbt-sales", "severity:warning"]
```

### 6.4 Repository Errors

```
name:    "[Feature] Repository Error Spike"
query:   sum(last_5m):sum:{app_name}.[feature].repository.errors_total{*}.as_count() > 10
message: "Repository error count for [feature] exceeded 10 in 5 minutes."
tags:    ["feature:[feature]", "team:cbt-sales", "severity:critical"]
```

---

## 7. SLI / SLO Reference

| SLI | Metric | Target |
|-----|--------|--------|
| Availability | `1 - (errors_total / requests_total)` | ≥ 99.9% |
| Latency | `p99(http.latency_ms)` | ≤ 500 ms |
| Repository success rate | `1 - (repository.errors_total / repository.calls_total)` | ≥ 99.5% |

Define SLOs in the Platform platform SLO dashboard and link them to the monitors above.
