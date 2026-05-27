# Java Scaffolding Guide

> Step-by-step guide to add a new feature to a Java / Spring Boot Platform service using Hexagonal Architecture.

---

## Step-by-Step

### 1. Domain Model

```java
// domain/[Feature].java
public record [Feature](
    String id,
    String name
    // add fields per API contract
) {}
```

**Rule**: Domain records/classes must not have Spring annotations (`@Entity`, `@Column`). Use separate entity classes in `infrastructure/persistence/`.

---

### 2. Inbound Port (Use Case Interface)

```java
// port/inbound/[Feature]UseCase.java
public interface [Feature]UseCase {
    List<[Feature]> get[Feature]s();
    [Feature] get[Feature]ById(String id);
}
```

---

### 3. Outbound Port (Repository Interface)

```java
// port/outbound/[Feature]Repository.java
public interface [Feature]Repository {
    List<[Feature]Entity> findAll();
    Optional<[Feature]Entity> findById(String id);
}
```

---

### 4. Use Case Implementation

```java
// application/usecase/[Feature]UseCaseImpl.java
@Service
@RequiredArgsConstructor
public class [Feature]UseCaseImpl implements [Feature]UseCase {

    private final [Feature]Repository repository;

    @Override
    public List<[Feature]> get[Feature]s() {
        return repository.findAll()
            .stream()
            .map([Feature]Mapper::toDomain)
            .collect(Collectors.toList());
    }

    @Override
    public [Feature] get[Feature]ById(String id) {
        return repository.findById(id)
            .map([Feature]Mapper::toDomain)
            .orElseThrow(() -> new [Feature]NotFoundException(id));
    }
}
```

---

### 5. JPA Entity + Repository Adapter

```java
// infrastructure/persistence/[Feature]Entity.java
@Entity
@Table(name = "[feature]s")
@Data
@NoArgsConstructor
public class [Feature]Entity {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;
}

// infrastructure/persistence/Jpa[Feature]Repository.java
@Repository
public interface Jpa[Feature]Repository extends JpaRepository<[Feature]Entity, String> {}

// infrastructure/persistence/[Feature]RepositoryAdapter.java
@Repository
@RequiredArgsConstructor
public class [Feature]RepositoryAdapter implements [Feature]Repository {

    private final Jpa[Feature]Repository jpa;

    @Override
    public List<[Feature]Entity> findAll() {
        return jpa.findAll();
    }

    @Override
    public Optional<[Feature]Entity> findById(String id) {
        return jpa.findById(id);
    }
}
```

---

### 6. Mapper

```java
// application/mapper/[Feature]Mapper.java
public final class [Feature]Mapper {

    private [Feature]Mapper() {}

    public static [Feature] toDomain([Feature]Entity entity) {
        return new [Feature](entity.getId(), entity.getName());
    }
}
```

---

### 7. Controller

```java
// controller/[Feature]Controller.java
@RestController
@RequestMapping("/v1/[feature]s")
@RequiredArgsConstructor
public class [Feature]Controller {

    private final [Feature]UseCase useCase;

    @GetMapping
    public ResponseEntity<List<[Feature]Response>> getAll() {
        return ResponseEntity.ok(
            useCase.get[Feature]s()
                .stream()
                .map([Feature]Response::from)
                .collect(Collectors.toList())
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<[Feature]Response> getById(@PathVariable String id) {
        return ResponseEntity.ok([Feature]Response.from(useCase.get[Feature]ById(id)));
    }
}
```

---

### 8. Request / Response DTOs

```java
// controller/dto/[Feature]Response.java
public record [Feature]Response(String id, String name) {
    public static [Feature]Response from([Feature] domain) {
        return new [Feature]Response(domain.id(), domain.name());
    }
}
```

---

### 9. Exception

```java
// application/exception/[Feature]NotFoundException.java
public class [Feature]NotFoundException extends RuntimeException {
    public [Feature]NotFoundException(String id) {
        super("[Feature] not found: " + id);
    }
}
```

Add handler in the global `@RestControllerAdvice`.

---

### 10. Tests

```java
// Unit test — Use Case
@ExtendWith(MockitoExtension.class)
class [Feature]UseCaseImplTest {

    @Mock
    private [Feature]Repository repository;

    @InjectMocks
    private [Feature]UseCaseImpl useCase;

    @Test
    void getById_returnsFeature_whenFound() {
        var entity = new [Feature]Entity();
        entity.setId("test-id");
        entity.setName("Test");

        when(repository.findById("test-id")).thenReturn(Optional.of(entity));

        [Feature] result = useCase.get[Feature]ById("test-id");

        assertThat(result.id()).isEqualTo("test-id");
        assertThat(result.name()).isEqualTo("Test");
    }

    @Test
    void getById_throwsNotFound_whenMissing() {
        when(repository.findById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase.get[Feature]ById("missing"))
            .isInstanceOf([Feature]NotFoundException.class);
    }
}
```

---

### 11. Verify

```bash
./mvnw verify        # Maven
./gradlew check      # Gradle
```
