# backend/gateway — Java 网关模块详细计划

> **职责边界**：本模块是纯粹的代理层和数据层，**不包含任何 AI 逻辑**。
> 所有 AI 推理、记忆管理均由 `backend/agent`（Python）负责。

---

## 1. 模块职责

| 职责 | 说明 |
|------|------|
| LeetCode 代理 | 以用户 Cookie 代理 LeetCode CN GraphQL，屏蔽 CORS |
| 题目缓存 | 本地 SQLite 缓存题目详情（TTL 24h），减少对 LeetCode 的请求 |
| 提交代理 | 转发代码提交到 LeetCode，轮询结果，存储历史记录 |
| Cookie 管理 | 存储/验证用户的 `LEETCODE_SESSION` + `csrftoken` |
| 静态资源服务 | 可选：serve `data/animations/*.mp4` 给前端播放 |

**不做的事**：AI 对话、记忆存储、Remotion 渲染、题目推荐算法——这些全在 Python agent 侧。

---

## 2. 完整目录结构

```
backend/gateway/
├── pom.xml
└── src/
    └── main/
        ├── java/com/algocoach/
        │   ├── GatewayApplication.java          # 启动类
        │   │
        │   ├── config/
        │   │   ├── CorsConfig.java              # 已实现：跨域配置
        │   │   ├── WebClientConfig.java         # 已实现：WebClient Bean 注册
        │   │   └── StaticResourceConfig.java    # 【待实现】animations/ 静态文件
        │   │
        │   ├── client/
        │   │   └── LeetCodeClient.java          # 已有：GraphQL WebClient 封装
        │   │
        │   ├── controller/
        │   │   ├── AuthController.java          # 已有：Cookie 存取
        │   │   ├── ProblemController.java       # 已有：题目查询
        │   │   ├── SubmissionController.java    # 【待实现】运行/提交
        │   │   └── AgentProxyController.java    # 【待实现，可选】代理到 Python
        │   │
        │   ├── service/
        │   │   ├── ProblemService.java          # 已有：GraphQL 查询逻辑
        │   │   ├── ProblemCacheService.java     # 【待实现】缓存读写
        │   │   └── SubmissionService.java       # 【待实现】提交 + 轮询
        │   │
        │   ├── model/
        │   │   ├── UserCookie.java              # 已有：Cookie JPA 实体
        │   │   ├── ProblemCache.java            # 【待实现】题目缓存实体
        │   │   └── SubmissionRecord.java        # 【待实现】提交记录实体
        │   │
        │   ├── repository/
        │   │   ├── UserCookieRepository.java    # 已有
        │   │   ├── ProblemCacheRepository.java  # 【待实现】
        │   │   └── SubmissionRepository.java    # 【待实现】
        │   │
        │   ├── dto/
        │   │   ├── SubmitRequest.java           # 【待实现】
        │   │   ├── SubmissionResultDto.java     # 【待实现】
        │   │   └── ErrorResponse.java           # 【待实现】
        │   │
        │   └── exception/
        │       └── GlobalExceptionHandler.java  # 【待实现】统一异常处理
        │
        └── resources/
            └── application.yml                  # 已有
```

---

## 3. 已有文件职责说明

### `GatewayApplication.java`
标准 Spring Boot 启动类，`@SpringBootApplication`，无额外配置。

### `LeetCodeClient.java`
核心代理类。用 Spring WebFlux `WebClient` 向 `https://leetcode.cn/graphql` 发送 POST 请求，从 `UserCookieRepository` 读取 Cookie 注入请求头（`Cookie`, `x-csrftoken`, `Referer`）。返回 `Mono<String>` 原始 JSON，由调用方解析。

**注意**：Cookie 不存在时抛出 `IllegalStateException`，需要在 `GlobalExceptionHandler` 中捕获返回 401。

### `AuthController.java`
- `POST /api/auth/cookie`：接收 `{session, csrf}` 存入 SQLite
- `GET /api/auth/status`：返回 `{authenticated: true/false}`

### `ProblemController.java`
三个端点全部是 `Mono<ResponseEntity<JsonNode>>`，响应式返回，直接透传 LeetCode GraphQL 响应的相关字段。

### `ProblemService.java`
封装三条 GraphQL query 字符串（`questionData`、`questionOfToday`、`questionList`），调用 `LeetCodeClient.graphql()`，解析 Jackson `JsonNode`。

### `UserCookie.java` / `UserCookieRepository.java`
单行 SQLite 记录（主键固定为 `"default"`），存储 session + csrf + 更新时间戳。

---

## 4. 模块详细规格（✅ 已实现 / 【待实现】在标题中标注）

### 4.1 `CorsConfig.java`（✅ 已实现）

实现位于 `src/main/java/com/algocoach/config/CorsConfig.java`，常量包括
`API_MAPPING = "/api/**"`、`VITE_DEV_ORIGIN`、`VITE_PREVIEW_ORIGIN`、`MAX_AGE_SECONDS = 3600`。
`CorsConfigTest` 用 MockMvc 验证：两个 Vite origin 的 preflight、允许的方法与请求头、
`maxAge=3600`、不返回 `Allow-Credentials`、非 `/api/**` 路径不加 CORS 头、未知 origin 返回 403。

```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            .allowedOrigins(
                "http://localhost:5173",   // Vite dev
                "http://localhost:4173"    // Vite preview
            )
            .allowedMethods("GET","POST","PUT","DELETE","OPTIONS")
            .allowedHeaders("*")
            .allowCredentials(false)
            .maxAge(3600);
    }
}
```

### 4.2 `WebClientConfig.java`（✅ 已实现）

注册 `WebClient.Builder` Bean，设置超时（连接 5000ms、响应 15s）。实现位于
`src/main/java/com/algocoach/config/WebClientConfig.java`，超时值以
`CONNECT_TIMEOUT_MILLIS` / `RESPONSE_TIMEOUT` 常量暴露，`createHttpClient()` 包级可见，
便于测试直接断言。`WebClientConfigTest` 覆盖两个超时值和 Reactor 连接器类型，并用
`ApplicationContextRunner` 确认上下文中只有一个 `WebClient.Builder`：自定义 Bean 使
Spring Boot `WebClientAutoConfiguration` 的 `@ConditionalOnMissingBean` 版本自动退让，
不存在 Bean 冲突。

```java
@Configuration
public class WebClientConfig {
    @Bean
    public WebClient.Builder webClientBuilder() {
        HttpClient httpClient = HttpClient.create()
            .responseTimeout(Duration.ofSeconds(15))
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000);
        return WebClient.builder()
            .clientConnector(new ReactorClientHttpConnector(httpClient));
    }
}
```

### 4.3 `ProblemCache.java`（JPA 实体）

```java
@Entity @Table(name = "problem_cache")
@Getter @Setter @NoArgsConstructor
public class ProblemCache {

    @Id
    private String titleSlug;          // LeetCode titleSlug，主键

    @Column(nullable = false, columnDefinition = "TEXT")
    private String contentJson;        // 完整 JSON 字符串（来自 GraphQL 响应）

    @Column(nullable = false)
    private Long cachedAt;             // Unix timestamp ms

    // TTL 检查
    @Transient
    public boolean isExpired() {
        return System.currentTimeMillis() - cachedAt > Duration.ofHours(24).toMillis();
    }
}
```

**缓存策略**（在 `ProblemCacheService.java` 中实现）：
1. 先查 SQLite
2. 命中且未过期 → 直接返回
3. 未命中或过期 → 请求 LeetCode → 存入 SQLite → 返回

```java
@Service
@RequiredArgsConstructor
public class ProblemCacheService {

    private final ProblemCacheRepository repo;
    private final ProblemService problemService;    // 下游 GraphQL

    public Mono<JsonNode> getBySlug(String slug) {
        return Mono.fromCallable(() -> repo.findById(slug))
            .flatMap(opt -> {
                if (opt.isPresent() && !opt.get().isExpired()) {
                    return Mono.just(parseJson(opt.get().getContentJson()));
                }
                return problemService.fetchBySlug(slug)
                    .doOnNext(node -> saveCache(slug, node));
            });
    }

    private void saveCache(String slug, JsonNode node) {
        repo.save(new ProblemCache(slug, node.toString(), System.currentTimeMillis()));
    }
}
```

`ProblemController` 改为调用 `ProblemCacheService` 而不是 `ProblemService`。

### 4.4 `SubmissionRecord.java`（JPA 实体）

```java
@Entity @Table(name = "submission_record")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@Builder
public class SubmissionRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String problemId;          // LeetCode questionId

    @Column(nullable = false)
    private String platform;           // "LEETCODE"

    @Column(nullable = false)
    private String status;             // ACCEPTED / WRONG_ANSWER / ...

    @Column(nullable = false)
    private String lang;               // rust / cpp / python3

    @Column(columnDefinition = "TEXT")
    private String code;               // 提交的代码

    private Integer runtimeMs;         // nullable，LeetCode 返回

    private Integer memoryMb;

    @Column(nullable = false)
    private Integer durationSec;       // 用户在 FOCUS 模式下花费的时间

    @Column(nullable = false)
    private String createdAt;          // ISO 8601
}
```

### 4.5 `SubmissionController.java`

```java
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class SubmissionController {

    private final SubmissionService submissionService;

    // 本地运行测试用例（MVP：直接代理到 LeetCode interpret_solution）
    @PostMapping("/run")
    public Mono<ResponseEntity<JsonNode>> run(@RequestBody RunRequest req) {
        return submissionService.run(req).map(ResponseEntity::ok);
    }

    // 正式提交
    @PostMapping("/submit")
    public Mono<ResponseEntity<SubmissionResultDto>> submit(@RequestBody SubmitRequest req) {
        return submissionService.submit(req).map(ResponseEntity::ok);
    }

    // 查询历史提交
    @GetMapping("/submissions")
    public ResponseEntity<List<SubmissionRecord>> history(
            @RequestParam(required = false) String problemId,
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(submissionService.history(problemId, limit));
    }
}
```

**DTO 定义**：

```java
// 请求
record SubmitRequest(
    @NotBlank String titleSlug,
    @NotBlank String code,
    @NotBlank String lang,       // "rust" | "cpp" | "python3"
    int durationSec              // FOCUS 模式耗时，前端计算
) {}

record RunRequest(
    String titleSlug,
    String code,
    String lang,
    String testInput             // 自定义测试用例，默认用题目 sampleTestCase
) {}

// 响应
record SubmissionResultDto(
    String id,
    String status,
    Integer runtimeMs,
    Integer memoryMb,
    Integer passedTests,
    Integer totalTests,
    String errorMessage,
    int durationSec
) {}
```

### 4.6 `SubmissionService.java`

```java
@Service
@RequiredArgsConstructor
public class SubmissionService {

    private static final int POLL_MAX_ATTEMPTS = 20;
    private static final Duration POLL_INTERVAL = Duration.ofMillis(1500);

    private final LeetCodeClient leetCode;
    private final SubmissionRepository repo;
    private final ObjectMapper mapper;

    public Mono<SubmissionResultDto> submit(SubmitRequest req) {
        // 1. 提交代码，获取 submission_id
        return postSubmit(req)
            // 2. 轮询结果
            .flatMap(submissionId -> pollResult(submissionId, POLL_MAX_ATTEMPTS))
            // 3. 存库
            .doOnNext(result -> saveRecord(req, result));
    }

    private Mono<String> postSubmit(SubmitRequest req) {
        // POST https://leetcode.cn/problems/{slug}/submit/
        // 返回 {"submission_id": 123456789}
        return leetCode.post(
            "/problems/" + req.titleSlug() + "/submit/",
            Map.of(
                "typed_code", req.code(),
                "lang", mapLang(req.lang()),
                "question_id", "..."    // 需先从缓存获取 questionId
            )
        ).map(json -> parseJson(json).path("submission_id").asText());
    }

    private Mono<SubmissionResultDto> pollResult(String submissionId, int attemptsLeft) {
        if (attemptsLeft <= 0) {
            return Mono.error(new RuntimeException("Submission polling timeout"));
        }
        return Mono.delay(POLL_INTERVAL)
            .then(leetCode.get("/submissions/detail/" + submissionId + "/check/"))
            .flatMap(json -> {
                JsonNode node = parseJson(json);
                String state = node.path("state").asText();
                if ("SUCCESS".equals(state) || "RUNTIME_ERROR".equals(state)
                        || "COMPILE_ERROR".equals(state)) {
                    return Mono.just(toDto(node));
                }
                // PENDING / STARTED — 继续轮询
                return pollResult(submissionId, attemptsLeft - 1);
            });
    }

    // LeetCode lang 字段映射
    private String mapLang(String lang) {
        return switch (lang) {
            case "cpp"     -> "cpp";
            case "python3" -> "python3";
            case "rust"    -> "rust";
            default        -> lang;
        };
    }
}
```

### 4.7 `GlobalExceptionHandler.java`

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    record ErrorResponse(int status, String code, String message) {}

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleCookieMissing(IllegalStateException e) {
        // Cookie 未设置时抛出
        return ResponseEntity.status(401)
            .body(new ErrorResponse(401, "COOKIE_MISSING",
                "LeetCode Cookie 未设置，请在设置页面粘贴 Cookie"));
    }

    @ExceptionHandler(WebClientResponseException.class)
    public ResponseEntity<ErrorResponse> handleWebClient(WebClientResponseException e) {
        if (e.getStatusCode().value() == 401) {
            return ResponseEntity.status(401)
                .body(new ErrorResponse(401, "COOKIE_EXPIRED",
                    "LeetCode Cookie 已过期，请重新粘贴"));
        }
        if (e.getStatusCode().value() == 429) {
            return ResponseEntity.status(429)
                .body(new ErrorResponse(429, "RATE_LIMITED",
                    "LeetCode 请求频率限制，请稍后再试"));
        }
        return ResponseEntity.status(502)
            .body(new ErrorResponse(502, "UPSTREAM_ERROR", e.getMessage()));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorResponse> handleRuntime(RuntimeException e) {
        return ResponseEntity.status(500)
            .body(new ErrorResponse(500, "INTERNAL_ERROR", e.getMessage()));
    }
}
```

### 4.8 `AgentProxyController.java`（可选）

将 `/api/agent/**` 透明代理到 Python FastAPI（`http://localhost:8000`），使前端只需面向单一端口（8080）：

```java
@RestController
@RequestMapping("/api/agent")
@RequiredArgsConstructor
public class AgentProxyController {

    @Value("${agent.base-url}")
    private String agentBaseUrl;

    private final WebClient.Builder clientBuilder;

    @RequestMapping(value = "/**", method = {RequestMethod.GET, RequestMethod.POST})
    public Mono<ResponseEntity<byte[]>> proxy(
            HttpServletRequest request,
            @RequestBody(required = false) byte[] body) {

        String path = request.getRequestURI().replaceFirst("/api/agent", "");
        return clientBuilder.baseUrl(agentBaseUrl).build()
            .method(HttpMethod.valueOf(request.getMethod()))
            .uri(path)
            .bodyValue(body != null ? body : new byte[0])
            .retrieve()
            .toEntity(byte[].class);
    }
}
```

---

## 5. LeetCode GraphQL 查询集（提交相关）

```graphql
# 提交代码（REST，非 GraphQL）
# POST https://leetcode.cn/problems/{titleSlug}/submit/
# Body: { typed_code, lang, question_id }
# Response: { submission_id }

# 轮询提交结果（REST）
# GET https://leetcode.cn/submissions/detail/{submission_id}/check/
# Response:
# {
#   "state": "SUCCESS" | "PENDING" | "STARTED" | "RUNTIME_ERROR" | "COMPILE_ERROR",
#   "status_msg": "Accepted",
#   "status_runtime": "0 ms",
#   "memory": 2048000,
#   "total_correct": 73,
#   "total_testcases": 73,
#   "runtime_percentile": 100.0,
#   "memory_percentile": 50.0,
#   "compile_error": "",
#   "last_testcase": "",
#   "expected_output": ""
# }

# 本地运行测试（REST）
# POST https://leetcode.cn/problems/{titleSlug}/interpret_solution/
# Body: { typed_code, lang, question_id, data_input }
# Response: { interpret_id }

# 轮询运行结果（REST）
# GET https://leetcode.cn/submissions/detail/{interpret_id}/check/
```

---

## 6. 提交轮询流程

```
前端 POST /api/submit
         │
         ▼
SubmissionService.submit()
         │
         ▼
POST leetcode.cn/problems/{slug}/submit/
         │  返回 submission_id
         ▼
┌── pollResult(submissionId, attempts=20) ──┐
│                                            │
│  delay(1.5s)                              │
│  GET /submissions/detail/{id}/check/      │
│         │                                  │
│         ├─ state=PENDING/STARTED ──────── retry (attempts-1)
│         │                                  │
│         ├─ state=SUCCESS ─────────────────┤
│         ├─ state=RUNTIME_ERROR ───────────┤ → toDto() → saveRecord() → 返回前端
│         └─ state=COMPILE_ERROR ───────────┘
│
└── attempts=0 → 超时错误 (503)
```

**超时处理**：
- 20次 × 1.5s = 最多等待 30 秒
- 超时返回 `{"status": "TIMEOUT", "message": "提交结果获取超时，请到 LeetCode 官网查看"}`
- 前端展示超时提示，不影响本地 durationSec 记录

---

## 7. 本地代码执行方案

### MVP 阶段（当前）
**不实现本地执行**，直接代理到 LeetCode：
- 运行测试 → 代理到 `interpret_solution`
- 正式提交 → 代理到 `submit`

### 未来阶段（v2）
使用 Docker sandbox 本地执行，优点：离线可用、无速率限制、可自定义测试用例。

```
技术方案：
1. 每种语言一个 Docker image（rust:1.79-alpine, gcc:14-alpine, python:3.12-alpine）
2. 执行时挂载用户代码到 /tmp/solution.*
3. 超时 5s kill，捕获 stdout/stderr
4. 结果对比期望输出

依赖：Docker Engine API（Java Docker Client: com.github.docker-java）
```

---

## 8. 数据库设计

SQLite 文件路径：`data/algocoach.db`（JPA `ddl-auto: update` 自动建表）

### 表结构

```sql
-- 用户 Cookie
CREATE TABLE user_cookie (
    user_id   TEXT PRIMARY KEY,          -- 固定 "default"（单用户 MVP）
    session   TEXT NOT NULL,
    csrf      TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 题目缓存
CREATE TABLE problem_cache (
    title_slug   TEXT PRIMARY KEY,
    content_json TEXT NOT NULL,          -- 完整 GraphQL JSON
    cached_at    INTEGER NOT NULL        -- Unix ms，超过 24h 认为过期
);
CREATE INDEX idx_problem_cache_cached_at ON problem_cache(cached_at);

-- 提交记录
CREATE TABLE submission_record (
    id           TEXT PRIMARY KEY,       -- UUID
    problem_id   TEXT NOT NULL,          -- LeetCode questionId
    platform     TEXT NOT NULL DEFAULT 'LEETCODE',
    status       TEXT NOT NULL,          -- ACCEPTED / WRONG_ANSWER / ...
    lang         TEXT NOT NULL,
    code         TEXT,
    runtime_ms   INTEGER,
    memory_mb    INTEGER,
    duration_sec INTEGER NOT NULL,       -- FOCUS 模式耗时
    created_at   TEXT NOT NULL           -- ISO 8601
);
CREATE INDEX idx_submission_problem ON submission_record(problem_id);
CREATE INDEX idx_submission_created ON submission_record(created_at);
```

---

## 9. API 接口文档

### 认证

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `POST` | `/api/auth/cookie` | `{session, csrf}` | `204` |
| `GET`  | `/api/auth/status` | — | `{authenticated: bool}` |

### 题目

| Method | Path | Params | Response |
|--------|------|--------|----------|
| `GET` | `/api/problems` | `page, difficulty?, tag?` | `{problems[], total}` |
| `GET` | `/api/problems/{slug}` | — | Problem JSON |
| `GET` | `/api/problems/daily` | — | Problem JSON |

### 提交

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `POST` | `/api/run` | `{titleSlug, code, lang, testInput?}` | RunResult JSON |
| `POST` | `/api/submit` | `{titleSlug, code, lang, durationSec}` | `SubmissionResultDto` |
| `GET`  | `/api/submissions` | `problemId?, limit?` | `SubmissionRecord[]` |

### 错误响应统一格式

```json
{
  "status": 401,
  "code": "COOKIE_MISSING",
  "message": "LeetCode Cookie 未设置，请在设置页面粘贴 Cookie"
}
```

**错误码列表**：

| code | status | 触发条件 |
|------|--------|---------|
| `COOKIE_MISSING` | 401 | 未设置 Cookie |
| `COOKIE_EXPIRED` | 401 | LeetCode 返回 401 |
| `RATE_LIMITED` | 429 | LeetCode 返回 429 |
| `SUBMISSION_TIMEOUT` | 503 | 轮询 20 次仍未有结果 |
| `UPSTREAM_ERROR` | 502 | LeetCode 其他错误 |
| `INTERNAL_ERROR` | 500 | 服务内部错误 |

---

## 10. 错误处理规范

### Cookie 过期检测
`LeetCodeClient` 收到 401 时抛出 `WebClientResponseException`，`GlobalExceptionHandler` 捕获后返回 `COOKIE_EXPIRED`。前端收到 401 后自动弹出 Cookie 重新输入面板（`CookieSetupPage`）。

### 频率限制（429）
LeetCode 对频繁请求有限流。处理方式：
1. 返回 429 给前端，提示"请稍后再试"
2. 后续可加 Redis 本地限速（每分钟最多 20 次 GraphQL 请求），题目命中缓存则不计入

### 网络超时
`WebClient` 连接超时 5s，响应超时 15s，超时后 `GlobalExceptionHandler` 返回 504。

---

## 11. 测试策略

### 依赖

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>com.github.tomakehurst</groupId>
    <artifactId>wiremock-standalone</artifactId>
    <version>3.0.1</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>io.projectreactor</groupId>
    <artifactId>reactor-test</artifactId>
    <scope>test</scope>
</dependency>
```

### 测试重点

```
src/test/java/com/algocoach/
├── config/
│   ├── CorsConfigTest.java          # preflight / origin 白名单 / 路径范围 / 403
│   └── WebClientConfigTest.java     # Builder 单例 + 5s/15s 超时 + 自动配置无冲突
├── client/
│   └── LeetCodeClientTest.java      # WireMock 模拟 GraphQL 响应 + Cookie 注入验证
├── service/
│   ├── ProblemCacheServiceTest.java # 缓存命中/过期逻辑单测
│   └── SubmissionServiceTest.java   # 轮询逻辑（PENDING→SUCCESS/超时）
├── controller/
│   ├── AuthControllerTest.java      # MockMvc Cookie 存取
│   └── SubmissionControllerTest.java
└── integration/
    └── FullFlowIT.java              # 完整 submit 流程集成测试（WireMock）
```

**`SubmissionServiceTest` 关键用例**：
```java
@Test void testSubmitSuccess_pollsUntilSuccess() {
    // mock: 前2次返回 PENDING，第3次返回 SUCCESS
}
@Test void testSubmitTimeout_throws() {
    // mock: 一直返回 PENDING，验证 20次后抛异常
}
@Test void testSubmitCompileError_returnsError() {
    // mock: 直接返回 COMPILE_ERROR
}
```

**WireMock 配置骨架**：
```java
@SpringBootTest(webEnvironment = RANDOM_PORT)
@AutoConfigureWireMock(port = 8089)
class LeetCodeClientTest {

    @Value("${leetcode.base-url}")
    String baseUrl;

    @BeforeEach void setupCookie() {
        // 插入测试 Cookie 到 SQLite
    }

    @Test void fetchBySlug_returnsCachedOnHit() {
        stubFor(post(urlEqualTo("/graphql"))
            .willReturn(okJson(MOCK_PROBLEM_JSON)));
        // ...
    }
}
```

---

## 12. 实现优先级

| 优先级 | 任务 | 预估工时 |
|--------|------|---------|
| P0 | ✅ `CorsConfig` + `WebClientConfig`（含聚焦测试） | 0.5h |
| P0 | `ProblemCache` 实体 + `ProblemCacheService` | 2h |
| P0 | `GlobalExceptionHandler` | 1h |
| P1 | `SubmissionRecord` 实体 + Repository | 1h |
| P1 | `SubmissionService`（提交 + 轮询） | 4h |
| P1 | `SubmissionController` | 1h |
| P2 | `AgentProxyController` | 1h |
| P2 | `StaticResourceConfig`（serve animations） | 0.5h |
| P3 | 单元测试 + 集成测试 | 4h |
