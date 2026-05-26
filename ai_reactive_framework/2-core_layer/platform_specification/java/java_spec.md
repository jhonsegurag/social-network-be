# Java Platform Specification

> Java / Spring Boot coding standards and Fury PaaS patterns for MercadoLibre backend services. Reference when building or reviewing Java microservices in the ecosystem.

---

## Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Language | Java | 17 (via SDKMAN) |
| Framework | Spring Boot | 3.x |
| Build tool | Maven or Gradle | — |
| DI | Spring IoC (constructor injection) | — |
| Validation | Jakarta Bean Validation (`@Valid`, `@NotNull`) | 3.x |
| HTTP client | Spring WebClient (reactive) or RestTemplate | — |
| Observability | Micrometer + OTel | — |
| Testing | JUnit 5 + Mockito + AssertJ | — |
| Module registry | `https://artifacts.furycloud.io/` | — |

---

## Architecture

Hexagonal Architecture aligned with Fury's layered service standards:

```
controller/          ← HTTP adapters (@RestController)
port/
  inbound/           ← Use case interfaces (called by controllers)
  outbound/          ← Repository/client interfaces (called by use cases)
application/
  usecase/           ← Business logic (implements inbound port)
  service/           ← Domain services
domain/              ← Pure domain models (no framework annotations)
infrastructure/
  persistence/       ← JPA repositories (implements outbound port)
  client/            ← External HTTP clients (implements outbound port)
```

---

## Component Standards

### Controllers

```java
@RestController
@RequestMapping("/v1/[feature]")
@RequiredArgsConstructor  // Lombok constructor injection
public class FeatureController {

    private final FeatureUseCase featureUseCase;

    @GetMapping
    public ResponseEntity<List<FeatureResponse>> getFeatures() {
        List<FeatureResponse> result = featureUseCase.getFeatures();
        return ResponseEntity.ok(result);
    }
}
```

- Always use **constructor injection** via `@RequiredArgsConstructor` — never field injection (`@Autowired`)
- Never add business logic in controllers — delegate to use case
- Return `ResponseEntity<T>` with explicit HTTP status

### Use Cases

```java
// Inbound port (interface)
public interface FeatureUseCase {
    List<Feature> getFeatures();
}

// Implementation
@UseCase  // custom stereotype annotation or @Service
@RequiredArgsConstructor
public class FeatureUseCaseImpl implements FeatureUseCase {

    private final FeatureRepository featureRepository;

    @Override
    public List<Feature> getFeatures() {
        return featureRepository.findAll()
            .stream()
            .map(this::toDomain)
            .collect(Collectors.toList());
    }
}
```

### Repositories (Outbound Port)

```java
// Outbound port
public interface FeatureRepository {
    List<FeatureEntity> findAll();
    Optional<FeatureEntity> findById(String id);
}

// JPA adapter
@Repository
public class JpaFeatureRepository implements FeatureRepository {
    private final FeatureJpaRepository jpa;

    @Override
    public List<FeatureEntity> findAll() {
        return jpa.findAll();
    }
}
```

---

## Error Handling

```java
// Custom exception hierarchy
public class FeatureNotFoundException extends RuntimeException {
    public FeatureNotFoundException(String id) {
        super("Feature not found: " + id);
    }
}

// Global exception handler
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(FeatureNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(FeatureNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse("not_found", ex.getMessage(), 404));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleInternal(Exception ex) {
        // Never expose internal details to the client
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(new ErrorResponse("internal_server_error", "An unexpected error occurred", 500));
    }
}
```

---

## Validation

```java
public record CreateFeatureRequest(
    @NotBlank String name,
    @Size(max = 100) String description,
    @Email String contactEmail
) {}

// In controller
@PostMapping
public ResponseEntity<Feature> create(@Valid @RequestBody CreateFeatureRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(featureUseCase.create(request));
}
```

---

## Logging

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

// Use SLF4J — never System.out.println
private static final Logger log = LoggerFactory.getLogger(FeatureUseCaseImpl.class);

log.info("Processing feature request featureId={}", featureId);
log.error("Repository error for featureId={}", featureId, exception);
```

- Never log PII, tokens, or passwords
- Use structured logging with key=value format in the message

---

## Security Checklist

- [ ] No hardcoded credentials — use Fury Secrets or Spring `@Value` from env vars
- [ ] Constructor injection only — no field injection
- [ ] Input validated with `@Valid` at controller boundary
- [ ] `@RestControllerAdvice` catches all exceptions — no raw stack traces in responses
- [ ] SQL via JPA/Criteria — no string concatenation with user input
- [ ] Authorization via MercadoLibre SDK — not custom logic
