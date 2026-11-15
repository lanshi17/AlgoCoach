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
| 静态资源服务 | ✅ P2：`GET /animations/**` 只读服务 Remotion 生成的 MP4（见 §4.9） |

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
        │   │   └── StaticResourceConfig.java    # ✅ P2 已实现：/animations/** 只读 MP4
        │   │
        │   ├── client/
        │   │   └── LeetCodeClient.java          # 已实现：GraphQL + REST WebClient 封装
        │   │
        │   ├── controller/
        │   │   ├── AuthController.java          # 已有：Cookie 存取
        │   │   ├── ProblemController.java       # 已有：题目查询
        │   │   ├── SubmissionController.java    # ✅ P1 已实现：运行/提交/历史
        │   │   └── AgentProxyController.java    # ✅ P2 已实现：代理到 Python（固定上游）
        │   │
        │   ├── service/
        │   │   ├── ProblemCacheService.java     # 已实现：24h 题目缓存读写
        │   │   ├── ProblemService.java          # 已有：GraphQL 查询逻辑
        │   │   └── SubmissionService.java       # ✅ P1 已实现：提交 + 运行 + 结果轮询 + 历史
        │   │
        │   ├── model/
        │   │   ├── UserCookie.java              # 已有：Cookie JPA 实体
        │   │   ├── ProblemCache.java            # 已实现：题目缓存实体
        │   │   └── SubmissionRecord.java        # P1 已实现：提交记录实体
        │   │
        │   ├── repository/
        │   │   ├── UserCookieRepository.java    # 已有
        │   │   ├── ProblemCacheRepository.java  # 已实现
        │   │   └── SubmissionRepository.java    # P1 已实现：历史记录查询
        │   │
        │   ├── dto/
        │   │   ├── SubmitRequest.java           # ✅ P1 已实现：正式提交请求
        │   │   ├── RunRequest.java              # ✅ P1 已实现：本地运行请求
        │   │   ├── SubmissionResultDto.java     # ✅ P1 已实现
        │   │   └── ErrorResponse.java           # 已实现：统一错误响应 {status,code,message}
        │   │
        │   └── exception/
        │       ├── CookieMissingException.java  # 已实现：明确的 Cookie 缺失异常
        │       ├── SubmissionTimeoutException.java # ✅ P1 已实现：轮询超时异常
        │       ├── InvalidLimitException.java   # ✅ P1 已实现：历史查询 limit<=0
        │       └── GlobalExceptionHandler.java  # 已实现：统一异常处理
        │
        └── resources/
            └── application.yml                  # 已有
```

---

## 3. 已有文件职责说明

### `GatewayApplication.java`
标准 Spring Boot 启动类，`@SpringBootApplication`，无额外配置。

### `LeetCodeClient.java`
核心代理类。用 Spring WebFlux `WebClient` 向 `https://leetcode.cn` 发送请求，从 `UserCookieRepository` 读取 Cookie 注入请求头（`Cookie`, `x-csrftoken`, `Referer`）。返回 `Mono<String>` 原始 JSON，由调用方解析。

- `graphql(query, variables)`：保留原有 GraphQL POST `/graphql`。
- `post(path, body)`：REST POST，提交使用 `/problems/{titleSlug}/submit/`。
- `get(path)`：REST GET，轮询使用 `/submissions/detail/{submissionId}/check/`。

三条路径共用同一组 Cookie / CSRF / Referer 头；Cookie 的 SQLite 读取放在
`Schedulers.boundedElastic()` 上，不占用 Netty 事件循环线程。

**注意**：Cookie 不存在时抛出专用的 `CookieMissingException`（不再使用 `IllegalStateException`，
避免把其他状态异常误判为 Cookie 缺失），由 `GlobalExceptionHandler` 返回 401 `COOKIE_MISSING`。

### `AuthController.java`
- `POST /api/auth/cookie`：接收前端从浏览器 curl 提取的 `{session, csrf}`，存入 SQLite；Gateway 不接收完整 curl
- `GET /api/auth/status`：返回 `{authenticated: true/false}`

请求体 Bean Validation 失败时由 `GlobalExceptionHandler` 统一返回 400 `VALIDATION_ERROR`。

### `ProblemController.java`
三个端点全部是 `Mono<ResponseEntity<JsonNode>>`，响应式返回，直接透传 LeetCode GraphQL 响应的相关字段。

### `ProblemService.java`
封装三条 GraphQL query 字符串（`questionData`、`questionOfToday`、`problemsetQuestionListV2`），调用 `LeetCodeClient.graphql()`，解析 Jackson `JsonNode`。

题目列表的 `filters` 变量类型是 `QuestionFilterInput`（不是同名的
`QuestionListFilterInputV2`）。空过滤返回全库；`difficulty` 映射到
`difficultyFilter.difficulties`（只接受 `EASY` / `MEDIUM` / `HARD`，其他值忽略），
`tag` 映射到 `topicFilter.topicSlugs`。同一 `topicFilter` 内的多个 slug 是 OR
关系（一个专项可覆盖多个官方标签），而 topic 与 difficulty 两个过滤对象之间是
AND。`totalLength` 一并返回，供前端计算真实页数。

### `AcWingService.java` / `AcWingController.java`
AcWing 题单与题面（匿名请求会被 302 到 `/403/` 或 `/login`，必须使用设置页保存的 Cookie）。

- 列表：`GET /api/acwing/problems?page&tag`。无 `tag` 时读 `/problem/{page}/`；有 `tag` 时走站点的
  标签搜索 `/problem/search/{page}/?search_content=<tag>`（专项即算法标签，如 `模拟`、`二分`、`动态规划`）。
  搜索命中的标签可能带 `<span class='es-search-highlight'>`，解析时会剥掉。
- 详情：`GET /api/acwing/problems/{id}` 提取 `div[data-field-name="content"]` 题面、`输入样例` 与
  `时/空限制`，并附带 `CodeTemplates.snippets()` 生成的六语言 starter 模板（AcWing 页面不含模板数据）。
- 难度：简单/中等/困难 → EASY/MEDIUM/HARD。

### `HduService.java` / `HduController.java`
杭电题单与题面。列表 `listproblem.php?vol=N` 的表格由内嵌 `p(color,pid,solved,title,ac,sub)` 调用生成，
每卷 100 题；详情 `showproblem.php?pid=` 为 GB18030 编码，解析
`Problem Description / Input / Output / Sample Input / Sample Output` 面板与 `Time Limit / Memory Limit`。
HDU 没有标签与难度，`topics` 为空、难度按 `MEDIUM`；详情同样附带六语言 starter 模板。

`PlatformCookieController.java` 提供 `GET /api/platforms`（三平台登录态汇总）、
`POST /api/platforms/{platform}/cookie` 与 `GET /api/platforms/{platform}/status`，支持 `ACWING` / `HDU`；
保存时由 `util/CookieHeader` 从原始 Cookie 头或整段 cURL 中提取并去除控制字符（否则 Netty 会因
`0xa` 等非法头字符回 502），读取时再做一次同样的规范化以兼容历史脏数据；Cookie 只写入本机 SQLite，
不回显、不写日志、不进入导出文件。

### `ProblemCacheService.java`
题目详情缓存层。`getBySlug(slug)` 先查 SQLite：命中且未过期（24h）直接返回
`contentJson`；未命中或过期经 `ProblemService.fetchBySlug()` 刷新后写回。阻塞的
JPA 调用使用 `Schedulers.boundedElastic()`，不占用 Netty 事件循环线程。

### `UserCookie.java` / `UserCookieRepository.java`
单行 SQLite 记录（主键固定为 `"default"`），存储 session + csrf + 更新时间戳。

---

## 4. 模块详细规格

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

### 4.3 `ProblemCache.java` + `ProblemCacheService.java`（✅ 已实现）

`ProblemCache` 对应 `problem_cache` 表：`titleSlug` 主键、`contentJson` 为 `TEXT`
完整题目 JSON、`cachedAt` 为 Unix 毫秒。TTL 固定 24 小时（`ProblemCache.TTL`），
`isExpired()` 用当前时间判断，`isExpired(nowMillis)` 供测试注入时间。

`@Table` 已声明索引 `idx_problem_cache_cached_at`（列为 `cached_at`），
`ddl-auto: update` 启动时会为已有 `problem_cache` 表补建该索引。

**缓存策略**（`ProblemCacheService.getBySlug`）：
1. 在 `Schedulers.boundedElastic()` 上查 SQLite（避免阻塞 Netty 线程）
2. 命中且未过期 → 反序列化 `contentJson` 直接返回，不请求 LeetCode
3. 未命中或过期 → `ProblemService.fetchBySlug()` 请求上游 → 写回 SQLite → 返回

缓存行 JSON 损坏时按未命中处理并刷新。`ProblemController` 仅
`GET /api/problems/{slug}` 调用 `ProblemCacheService`；列表与每日题仍直接调用
`ProblemService`，三个端点的响应 JSON 形状保持不变。

`ProblemCacheServiceTest` 覆盖：23h 命中无上游请求、miss 写入、25h 过期刷新；
`ProblemCacheTest` 覆盖 24h TTL 边界；`ProblemCacheSchemaTest` 校验 `@Table` 的索引声明，
并用临时 SQLite 库验证 `ddl-auto: update` 会在已有表上实际创建 `cached_at` 索引；
`ProblemControllerTest` 固定“只有 bySlug 走缓存”的路由范围。

### 4.4 `SubmissionRecord.java`（✅ 已实现）

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
    private String lang;               // rust / cpp / python3 / typescript / golang / java

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

实现位于 `model/SubmissionRecord.java`，映射到 `submission_record`，并显式声明 snake_case
列名与 §8 的 `idx_submission_problem` / `idx_submission_created` 索引（`ddl-auto: update`
建表时创建）。`id` 在首次持久化时由 Hibernate 生成 UUID；`createdAt` 原样保存 ISO 8601
字符串；`code` 为 SQLite `TEXT`，`runtimeMs` / `memoryMb` 可空。测试见
`SubmissionRecordTest`（表名/索引/列映射与约束）、`SubmissionRecordPersistenceTest`
（SQLite 持久化、UUID 生成、NOT NULL）和 `SubmissionRepositoryTest`（过滤与倒序）。

### 4.5 `SubmitRequest` / `RunRequest` / `SubmissionResultDto` 与 `SubmissionController`（✅ P1 已实现）

DTO 实现位于 `dto/SubmitRequest.java`、`dto/RunRequest.java` 与
`dto/SubmissionResultDto.java`：

```java
public record SubmitRequest(
    @NotBlank String titleSlug,
    @NotBlank String code,
    @NotBlank String lang,       // "rust" | "cpp" | "python3" | "typescript" | "golang" | "java"
    int durationSec              // FOCUS 模式耗时，前端计算
) {}

public record RunRequest(
    @NotBlank String titleSlug,
    @NotBlank String code,
    @NotBlank String lang,       // "rust" | "cpp" | "python3" | "typescript" | "golang" | "java"
    String testInput             // 可选；为空时回退到缓存的 sampleTestCase
) {}

public record SubmissionResultDto(
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

`SubmissionController` 实现位于 `controller/SubmissionController.java`，三个端点：

- `POST /api/run`：`@Valid` 校验 `RunRequest`，调用 `SubmissionService.run`，返回
  `Mono<ResponseEntity<JsonNode>>`；响应体是 LeetCode `check` 的原始 JSON，不映射成 DTO，
  也不写历史记录。
- `POST /api/submit`：`@Valid` 校验 `SubmitRequest`，复用既有 `SubmissionService.submit`，
  返回 `Mono<ResponseEntity<SubmissionResultDto>>`。
- `GET /api/submissions`：可选 `problemId` 过滤，`limit` 默认
  `DEFAULT_HISTORY_LIMIT = 20`；同步调用 `SubmissionService.history`，返回
  `ResponseEntity<List<SubmissionRecord>>`。`limit <= 0` 抛 `InvalidLimitException`，由
  `GlobalExceptionHandler` 映射为 400 `VALIDATION_ERROR`。

```java
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class SubmissionController {

    static final int DEFAULT_HISTORY_LIMIT = 20;

    private final SubmissionService submissionService;

    // 本地运行测试用例（MVP：直接代理到 LeetCode interpret_solution）
    @PostMapping("/run")
    public Mono<ResponseEntity<JsonNode>> run(@Valid @RequestBody RunRequest request) {
        return submissionService.run(request).map(ResponseEntity::ok);
    }

    // 正式提交
    @PostMapping("/submit")
    public Mono<ResponseEntity<SubmissionResultDto>> submit(@Valid @RequestBody SubmitRequest request) {
        return submissionService.submit(request).map(ResponseEntity::ok);
    }

    // 查询历史提交
    @GetMapping("/submissions")
    public ResponseEntity<List<SubmissionRecord>> history(
            @RequestParam(required = false) String problemId,
            @RequestParam(defaultValue = "" + DEFAULT_HISTORY_LIMIT) int limit) {
        return ResponseEntity.ok(submissionService.history(problemId, limit));
    }
}
```

`RunRequest` 的必填字段在 MVC 绑定阶段校验；`/api/run`、`/api/submit` 与历史查询均已实现。

### 4.6 `SubmissionService.java`（✅ P1 已实现）

实现位于 `service/SubmissionService.java`，负责正式提交/结果轮询、本地运行和历史查询：

**正式提交（`submit`）**

1. **取 questionId**：`ProblemCacheService.getBySlug(titleSlug)` 读取（或刷新）题目详情，
   取其中的 `questionId`；缓存行缺少该字段时快速失败，不会提交。
2. **提交**：`POST /problems/{titleSlug}/submit/`，body 为
   `{typed_code, lang, question_id}`；`lang` 做语言映射（`rust` / `cpp` / `python3` / `typescript` / `golang` / `java`，未知值原样转发），
   `question_id` 来自第 1 步。响应里的 `submission_id` 作为后续轮询 id，也会放进结果 DTO。
3. **轮询**：最多 `POLL_MAX_ATTEMPTS = 20` 次，每次先 `delay(1500ms)` 再
   `GET /submissions/detail/{submissionId}/check/`；`state` 为 `SUCCESS` /
   `RUNTIME_ERROR` / `COMPILE_ERROR` 时终止，`PENDING` / `STARTED` 继续下一次。
   总耗时上限 20 × 1.5s = 30s。
4. **结果映射**（`SubmissionResultDto`）：
   - `status`：优先取 `status_msg`（`Accepted` / `Wrong Answer` / `Time Limit Exceeded` /
     `Memory Limit Exceeded` / `Runtime Error` / `Compile Error`），规范化为
     `ACCEPTED` / `WRONG_ANSWER` / `TIME_LIMIT` / `MEMORY_LIMIT` / `RUNTIME_ERROR` /
     `COMPILE_ERROR`；缺失时回退到 `state`。
   - `runtimeMs`：解析 `status_runtime` 的前导整数（如 `"3 ms"` → `3`），无法解析则为 `null`。
   - `memoryMb`：LeetCode 的 `memory` 单位是字节，按十进制 MB 四舍五入（`2048000` → `2`）。
   - `passedTests` / `totalTests`：`total_correct` / `total_testcases`。
   - `errorMessage`：优先 `compile_error`，其次 `runtime_error`，都没有则为 `null`。
   - `id` 为提交返回的 submission id，`durationSec` 原样来自请求。
5. **保存记录**：只在终态后写一条 `SubmissionRecord`，字段为
   `problemId = questionId`、`platform = "LEETCODE"`、语言/代码/状态/耗时/可空结果字段，
   `createdAt = Instant.now().toString()`（UTC ISO-8601，如 `2026-11-13T03:48:03.123Z`）。
   阻塞的 JPA `save` 放在 `Schedulers.boundedElastic()` 上，不占用 Netty 事件循环线程。
   轮询耗尽或任何非终态都不会写记录，也不会提前伪造结果。
6. **通知记忆**：本地提交记录成功写入后，调用配置的 `${agent.base-url}/memory/record`，发送
   `titleSlug`、平台、终态、语言、FOCUS 用时和题目 topic tags；最多等待 2 秒。Agent 失败只记
   不含请求敏感内容的日志，不会影响提交结果或本地记录。
7. **超时**：LeetCode 结果轮询耗尽时抛 `SubmissionTimeoutException`，由 `GlobalExceptionHandler`
   返回统一 `503 SUBMISSION_TIMEOUT`（见 §4.7、§6）。

核心流程（与实际实现一致）：

```java
public Mono<SubmissionResultDto> submit(SubmitRequest request) {
    return problemCacheService.getBySlug(request.titleSlug())
            .flatMap(problem -> {
                String questionId = questionId(problem);
                return postSubmit(request, questionId)
                    .flatMap(submissionId -> pollResult(
                            submissionId, request.durationSec(), POLL_MAX_ATTEMPTS))
                    .flatMap(result -> saveRecord(request, questionId, result)
                            .flatMap(saved -> recordMemory(request, problem, questionId, saved)));
            });
}

private Mono<SubmissionResultDto> pollResult(
        String submissionId, int durationSec, int attemptsLeft) {
    if (attemptsLeft <= 0) {
        return Mono.error(new SubmissionTimeoutException());
    }
    return Mono.delay(POLL_INTERVAL)
            .then(leetCode.get("/submissions/detail/" + submissionId + "/check/"))
            .map(this::parse)
            .flatMap(json -> TERMINAL_STATES.contains(json.path("state").asText())
                    ? Mono.just(toDto(submissionId, json, durationSec))
                    : pollResult(submissionId, durationSec, attemptsLeft - 1));
}
```

**本地运行（`run`）**

7. **取输入**：`ProblemCacheService.getBySlug(titleSlug)` 读取 `questionId` 与
   `sampleTestCase`；`testInput` 非 `null` 且非空白时优先使用自定义输入，否则回退到
   `sampleTestCase`（缺失按空串处理）。
8. **运行**：`POST /problems/{titleSlug}/interpret_solution/`，body 为
   `{typed_code, lang, question_id, data_input}`，响应取 `interpret_id`；
   `lang` 与提交共用同一套映射。
9. **轮询与返回**：复用提交的 `POLL_MAX_ATTEMPTS = 20` × 1.5s 有界轮询，
   `GET /submissions/detail/{interpret_id}/check/`；到达终态（`SUCCESS` /
   `RUNTIME_ERROR` / `COMPILE_ERROR`）时把该次 `check` JSON 原样作为 `JsonNode` 返回，
   **不写** `SubmissionRecord`。尝试耗尽同样抛 `SubmissionTimeoutException`，由统一处理器
   返回 503 `SUBMISSION_TIMEOUT`（与提交超时同一映射）。

**历史查询（`history`）**

10. **参数校验**：`limit <= 0` 抛 `InvalidLimitException`，`GlobalExceptionHandler` 返回
    400 `VALIDATION_ERROR`；不做静默截断。
11. **数据库限行**：构造 `PageRequest.of(0, limit)` 传给 repository 的 Pageable 派生查询，
    SQL 只返回 `limit` 行。`problemId` 为空（`null` / 空白）时查全部，否则按
    `problemId` 过滤；两种查询都按 `createdAt` 倒序。

```java
public Mono<JsonNode> run(RunRequest request) {
    return problemCacheService.getBySlug(request.titleSlug())
            .flatMap(problem -> postInterpret(request, questionId(problem),
                            dataInput(request, problem))
                    .flatMap(interpretId -> pollRun(interpretId, POLL_MAX_ATTEMPTS)));
}

public List<SubmissionRecord> history(String problemId, int limit) {
    if (limit <= 0) {
        throw new InvalidLimitException();
    }
    Pageable page = PageRequest.of(0, limit);
    if (problemId == null || problemId.isBlank()) {
        return repository.findAllByOrderByCreatedAtDesc(page);
    }
    return repository.findByProblemIdOrderByCreatedAtDesc(problemId, page);
}
```

`SubmissionRepository` 同时保留不带 `Pageable` 的派生查询供已有测试/调用方使用，并新增：

```java
List<SubmissionRecord> findAllByOrderByCreatedAtDesc(Pageable pageable);
List<SubmissionRecord> findByProblemIdOrderByCreatedAtDesc(String problemId, Pageable pageable);
```

### 4.7 `GlobalExceptionHandler.java`（✅ 已实现）

实现位于 `src/main/java/com/algocoach/exception/GlobalExceptionHandler.java`，统一响应体使用
`dto/ErrorResponse.java` 的 `{status, code, message}`。所有 `message` 都是固定文案，响应中不
包含异常消息、上游 body、堆栈或 Cookie 内容；上游错误只记录状态码，未预期异常只写服务端日志。

**错误映射**：

| 触发条件 | status | code |
|----------|--------|------|
| `CookieMissingException`（未设置 Cookie） | 401 | `COOKIE_MISSING` |
| `WebClientResponseException`，上游 401 | 401 | `COOKIE_EXPIRED` |
| `WebClientResponseException`，上游 429 | 429 | `RATE_LIMITED` |
| 其他 `WebClientResponseException` | 502 | `UPSTREAM_ERROR` |
| `WebClientRequestException`，cause 链含 `TimeoutException` | 504 | `UPSTREAM_TIMEOUT` |
| `MethodArgumentNotValidException` / `HttpMessageNotReadableException` | 400 | `VALIDATION_ERROR` |
| `InvalidLimitException`（历史查询 `limit <= 0`） | 400 | `VALIDATION_ERROR` |
| `NoResourceFoundException`（静态动画不存在或越界） | 404 | `NOT_FOUND` |
| `SubmissionTimeoutException`（提交/运行轮询 20 次仍无终态） | 503 | `SUBMISSION_TIMEOUT` |
| 其他未预期 `Exception`（含普通 `IllegalStateException`） | 500 | `INTERNAL_ERROR` |

超时判断会遍历 cause 链，因此 Reactor Netty 的 `ReadTimeoutException` /
`ConnectTimeoutException`（都继承 `TimeoutException`）会被识别为 `UPSTREAM_TIMEOUT`；
非超时网络错误按 `UPSTREAM_ERROR` 处理。只有 `CookieMissingException` 会映射到
`COOKIE_MISSING`，普通 `IllegalStateException` 仍走 500 兜底。

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(CookieMissingException.class)
    public ResponseEntity<ErrorResponse> handleCookieMissing(CookieMissingException e) {
        return error(HttpStatus.UNAUTHORIZED, "COOKIE_MISSING",
                "LeetCode Cookie 未设置，请在设置页面粘贴 Cookie");
    }

    @ExceptionHandler(WebClientResponseException.class)
    public ResponseEntity<ErrorResponse> handleUpstreamResponse(WebClientResponseException e) {
        int upstreamStatus = e.getStatusCode().value();
        if (upstreamStatus == 401) {
            return error(HttpStatus.UNAUTHORIZED, "COOKIE_EXPIRED", "LeetCode Cookie 已过期，请重新粘贴");
        }
        if (upstreamStatus == 429) {
            return error(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "LeetCode 请求频率限制，请稍后再试");
        }
        return error(HttpStatus.BAD_GATEWAY, "UPSTREAM_ERROR", "LeetCode 服务暂时不可用，请稍后再试");
    }

    @ExceptionHandler(WebClientRequestException.class)
    public ResponseEntity<ErrorResponse> handleUpstreamRequest(WebClientRequestException e) {
        if (isTimeout(e)) {
            return timeout();
        }
        return error(HttpStatus.BAD_GATEWAY, "UPSTREAM_ERROR", "LeetCode 服务暂时不可用，请稍后再试");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "请求参数校验失败，请检查后重试");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception e) {
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "服务器内部错误，请稍后再试");
    }
}
```

实际实现还包含 `TimeoutException`、`HttpMessageNotReadableException`、
`NoResourceFoundException`、`SubmissionTimeoutException` 处理器和统一的 `error(...)` 辅助方法；
`GlobalExceptionHandlerTest` 用 MockMvc 覆盖上述全部映射（含 503 `SUBMISSION_TIMEOUT`）。

### 4.8 `AgentProxyController.java`（✅ P2 已实现）

把前端对 Python FastAPI 的调用统一收敛到网关端口（8080）。外部路径以 `/api/agent` 开头，
转发到 `agent.base-url`（默认 `http://localhost:8000`，见 `application.yml`）时去掉该前缀。
路由严格对齐 `backend/agent/app/agent/router.py` 当前实际注册的接口：

| 网关外部路径 | 上游路径 |
|--------------|----------|
| `POST /api/agent/chat` | `POST /chat` |
| `POST /api/agent/memory/record` | `POST /memory/record` |
| `GET /api/agent/memory/profile` | `GET /memory/profile` |
| `GET /api/agent/memory/export` | `GET /memory/export` |
| `POST /api/agent/animate` | `POST /animate` |
| `POST /api/agent/animate/generated` | `POST /animate/generated` |
| `GET /api/agent/animate/{jobId}` | `GET /animate/{jobId}` |

FastAPI 已注册 `/memory/profile` 和 `/memory/export`，网关通过固定上游代理进度与数据导出接口。


**转发语义**：

- 保留原始 HTTP 方法、query string 和**原始请求体字节**，不解析也不重新序列化 JSON。
- 请求头只传递明确需要的两个：`Content-Type`（让 FastAPI 正确解析 body）和
  `Authorization`（`/animate/generated` 需要 Bearer token）。`Cookie`、`Host`、
  `Connection`、`Transfer-Encoding`、`Upgrade` 等 hop-by-hop 或调用方私有头一律不转发。
- 响应透明返回上游的 HTTP status、body 和 `Content-Type`，并保留对调用方有意义的
  `Retry-After`（429）与 `WWW-Authenticate`（401）；其余传输层响应头不复制。
- 使用 WebClient 的 `exchangeToMono`，上游 4xx/5xx 是**普通响应**，不会抛
  `WebClientResponseException`，因此 401/429/503 等按原状态码返回，不会被改写成网关错误。
- 连接失败、超时等传输异常仍抛给 `GlobalExceptionHandler`，沿用 502 `UPSTREAM_ERROR` /
  504 `UPSTREAM_TIMEOUT` 的统一错误响应。

**安全边界**：`agent.base-url` 只在启动时读取一次，上游 URI 由“固定 base URL + 常量路由路径 +
请求原始 query string”拼成。请求参数无法覆盖 base URL，路由也没有 `/**` 通配，因此不能把
该代理用作任意主机或任意路径的开放代理。`WebClient.Builder` 先 `clone()` 再 `build()`，
避免修改 `LeetCodeClient` 共享的 builder。

```java
@RestController
@RequestMapping("/api/agent")
public class AgentProxyController {

    private final WebClient agentClient;
    private final String agentBaseUrl;

    public AgentProxyController(WebClient.Builder webClientBuilder,
                                @Value("${agent.base-url}") String agentBaseUrl) {
        this.agentBaseUrl = normalizeBaseUrl(agentBaseUrl);
        this.agentClient = webClientBuilder.clone().build();
    }

    @PostMapping("/chat")
    public Mono<ResponseEntity<byte[]>> chat(HttpServletRequest request,
                                             @RequestBody(required = false) byte[] body) {
        return forward(HttpMethod.POST, "/chat", request, body);
    }

    // /memory/record、/animate、/animate/generated 为同构的 POST 方法

    @GetMapping("/animate/{jobId}")
    public Mono<ResponseEntity<byte[]>> animateStatus(@PathVariable String jobId,
                                                      HttpServletRequest request) {
        return forward(HttpMethod.GET, "/animate/" + jobId, request, null);
    }

    private Mono<ResponseEntity<byte[]>> forward(HttpMethod method, String upstreamPath,
                                                 HttpServletRequest request, byte[] body) {
        WebClient.RequestBodySpec prepared = agentClient.method(method)
                .uri(upstreamUri(upstreamPath, request.getQueryString()))
                .headers(headers -> copyRequestHeaders(request, headers));
        WebClient.RequestHeadersSpec<?> withBody = body != null ? prepared.bodyValue(body) : prepared;
        return withBody.exchangeToMono(response -> response.bodyToMono(byte[].class)
                .defaultIfEmpty(new byte[0])
                .map(responseBody -> ResponseEntity.status(response.statusCode())
                        .headers(headers -> copyResponseHeaders(
                                response.headers().asHttpHeaders(), headers))
                        .body(responseBody)));
    }
}
```

`AgentProxyControllerTest` 用 fake `ExchangeFunction` + MockMvc 覆盖七条路由、query/body/
`Authorization` 转发、200/401/429/503 的 status/header/body 透明传递、上游不可达映射为
502 `UPSTREAM_ERROR`，以及 base URL 不可被请求参数覆盖；不访问真实 Python 服务。

### 4.9 `StaticResourceConfig.java`（✅ P2 已实现）

实现位于 `src/main/java/com/algocoach/config/StaticResourceConfig.java`。Agent 生成的
MP4 写入 `OUTPUT_DIR`，并把 `video_url` 固定为 `/animations/{jobId}.mp4`；网关用这一个
只读资源映射把该 URL 直接提供给前端播放。

**配置**：唯一属性 `animations.location`（`ANIMATIONS_LOCATION`），默认
`file:../../data/animations/`，已在 `application.yml` 中声明。

| 运行方式 | 配置 | 实际目录 |
|----------|------|----------|
| 本地 README（`cd backend/gateway` 启动） | 默认 `file:../../data/animations/` | 仓库根 `data/animations` |
| docker-compose | `ANIMATIONS_LOCATION=file:/data/animations/` | 共享挂载 `./data:/data` 下的 `data/animations`，与 agent 的 `OUTPUT_DIR=/data/animations` 一致 |

**规范化与校验**（启动时一次完成）：

- 只接受 `file:` 位置；空值、`classpath:`、`http(s):` 或带远端 host 的 `file://host/...`
  直接抛 `IllegalArgumentException`，启动失败而不是静默回退到其他目录。
- 相对路径按进程工作目录解析；`..` 段被规范化掉；最终转成绝对 `file:` URI 并补齐末尾
  `/`（Spring 资源解析要求目录位置以 `/` 结尾）。

**只读边界**：映射固定为 `/animations/**`，请求路径不能选择文件系统位置。Spring 的
`PathResourceResolver` 只解析配置根目录下的资源，`../`（含 `%2e%2e`、`..%2F` 编码形式）
越界请求返回 404；资源处理器只允许 GET/HEAD，不提供上传或删除。缺失文件由
`GlobalExceptionHandler` 映射为 404 `NOT_FOUND`，而不是落到 500 兜底。

**响应行为**：按扩展名返回 `video/mp4`；支持 HTTP Range，`Range: bytes=0-3` 返回
`206 Partial Content`、`Accept-Ranges: bytes` 和 `Content-Range`，便于浏览器拖动进度条。

```java
@Configuration
public class StaticResourceConfig implements WebMvcConfigurer {

    public static final String ANIMATIONS_MAPPING = "/animations/**";

    public StaticResourceConfig(
            @Value("${animations.location:file:../../data/animations/}") String location) {
        this.resourceLocation = normalizeLocation(location);
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler(ANIMATIONS_MAPPING)
                .addResourceLocations(resourceLocation);
    }
}
```

`StaticResourceConfigTest` 用 `@WebMvcTest` + `@TempDir` 临时目录和动态属性验证：
配置位置生效、合法 MP4 返回 `200`/`video/mp4`/原始字节、缺失文件 `404`、三种 `../`
变体不能读取根目录外文件、Range 返回 `206`，以及相对/绝对路径规范化（含末尾斜杠和
`..` 折叠）与非法配置拒绝。

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
- 尝试次数耗尽时抛 `SubmissionTimeoutException`，`GlobalExceptionHandler` 返回统一
  `503` + `{"status": 503, "code": "SUBMISSION_TIMEOUT", "message": "提交结果获取超时，请到 LeetCode 官网查看"}`
- 超时不会写 `SubmissionRecord`，也不会伪造部分结果；前端展示提示并引导用户到 LeetCode 官网查看

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

-- 题目缓存（P0 已实现；cached_at 索引由 @Table 声明，ddl-auto: update 自动创建）
CREATE TABLE problem_cache (
    title_slug   TEXT PRIMARY KEY,
    content_json TEXT NOT NULL,          -- 完整 GraphQL JSON
    cached_at    INTEGER NOT NULL        -- Unix ms，超过 24h 认为过期
);
CREATE INDEX idx_problem_cache_cached_at ON problem_cache(cached_at);

-- 提交记录（P1 已实现；两个索引由 @Table 声明，ddl-auto: update 自动创建）
CREATE TABLE submission_record (
    id           TEXT PRIMARY KEY,       -- UUID
    problem_id   TEXT NOT NULL,          -- LeetCode questionId
    platform     TEXT NOT NULL,          -- 固定 "LEETCODE"，由写入方显式设置
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
| `GET` | `/api/problems` | `page, difficulty?, tag?`（`tag` 为逗号分隔的 LeetCode topic slug，如 `dynamic-programming,memoization`） | LeetCode v2 列表节点（`hasMore`, `totalLength`, `questions[]`） |
| `GET` | `/api/problems/{slug}` | — | Problem JSON |
| `GET` | `/api/problems/daily` | — | Problem JSON |
| `GET` | `/api/acwing/problems` | `page, tag?`（AcWing 算法标签，如 `模拟`、`动态规划`，走标签搜索） | `{platform, page, pageSize, total, problems[]}` |
| `GET` | `/api/acwing/problems/{id}` | — | Problem JSON（含六语言 starter 模板） |
| `GET` | `/api/hdu/problems` | `volume` | `{platform, page, pageSize, total, problems[]}` |
| `GET` | `/api/hdu/problems/{pid}` | — | Problem JSON（含六语言 starter 模板） |
| `GET` | `/api/platforms` | — | `{LEETCODE, ACWING, HDU}` |
| `POST` | `/api/platforms/{platform}/cookie` | `{cookie}` | `200` |
| `GET` | `/api/platforms/{platform}/status` | — | `{configured}` |

### 运行与提交

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `POST` | `/api/run` | `{titleSlug, code, lang, testInput?}` | LeetCode `check` 原始 JSON |
| `POST` | `/api/submit` | `{titleSlug, code, lang, durationSec}` | `SubmissionResultDto` |
| `GET`  | `/api/submissions` | `problemId?, limit?` | `SubmissionRecord[]` |

`POST /api/run`：

- 请求体必填 `titleSlug` / `code` / `lang`，`testInput` 可选；`@Valid` 失败返回 400
  `VALIDATION_ERROR`。
- `testInput` 非空白时作为 `data_input`，否则使用缓存题目详情里的 `sampleTestCase`。
- 200 响应是 LeetCode `check` 接口的原始 JSON（`state`、`status_msg`、`code_answer`、
  `expected_code_answer`、`std_output_list` 等），不做 DTO 映射，也不写历史记录。
- 有界轮询 20 × 1.5s 仍无终态时返回 503 `SUBMISSION_TIMEOUT`。

`POST /api/submit`：`@Valid` 校验请求体后调用既有 `SubmissionService.submit`，返回
`SubmissionResultDto`；终态后写入一条 `SubmissionRecord`，超时返回 503 且不写记录。

`GET /api/submissions`：`problemId` 可选；`limit` 默认 20，`limit <= 0` 返回 400
`VALIDATION_ERROR`。结果按 `createdAt` 倒序，`limit` 通过 `Pageable` 在 SQL 层生效。

### Agent 代理（P2）

| Method | Path | 上游 | Request | Response |
|--------|------|------|---------|----------|
| `POST` | `/api/agent/chat` | `POST /chat` | `{message, mode, problemId?, trainingPhase?, timeRemainingSec?}` | 上游原始 JSON |
| `POST` | `/api/agent/memory/record` | `POST /memory/record` | `MemoryRecordRequest` | 上游原始 JSON |
| `POST` | `/api/agent/animate` | `POST /animate` | `{type, topic?, title?, problemId?}` | 上游原始 JSON |
| `POST` | `/api/agent/animate/generated` | `POST /animate/generated` | `GeneratedAnimationRequest` + `Authorization: Bearer <token>` | 上游原始 JSON |
| `GET`  | `/api/agent/animate/{jobId}` | `GET /animate/{jobId}` | — | 上游原始 JSON |

代理语义见 §4.8：保留 method、query string 和原始 body，只转发 `Content-Type` 与
`Authorization`；上游的 HTTP status、body、`Content-Type`、`Retry-After` 和
`WWW-Authenticate` 原样返回。上游 4xx/5xx（含 `401`、`429`、`503`）不会被网关改写；
只有连接失败/超时走 §10 的统一错误映射（502 `UPSTREAM_ERROR` / 504 `UPSTREAM_TIMEOUT`）。
`agent.base-url` 由启动配置决定，不能通过请求参数覆盖；`/memory/profile` 与 `/memory/export` 已注册并由网关固定代理。

### 静态动画资源（P2）

| Method | Path | 说明 | Response |
|--------|------|------|----------|
| `GET` / `HEAD` | `/animations/{jobId}.mp4` | 只读服务 `animations.location` 下的 MP4；支持 Range | `200`（`video/mp4`）或 `206 Partial Content`；不存在/越界为 `404 NOT_FOUND` |

路径与目录配置见 §4.9。Agent 返回的 `video_url`（`/animations/{jobId}.mp4`）无需改写即可
通过网关 8080 直接播放。

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
| `VALIDATION_ERROR` | 400 | 请求体 Bean Validation 失败、JSON 无法解析，或历史查询 `limit <= 0` |
| `COOKIE_MISSING` | 401 | 未设置 Cookie |
| `COOKIE_EXPIRED` | 401 | LeetCode 返回 401 |
| `NOT_FOUND` | 404 | 静态动画文件不存在，或路径越出配置的 `animations.location` |
| `RATE_LIMITED` | 429 | LeetCode 返回 429 |
| `INTERNAL_ERROR` | 500 | 服务内部未预期错误 |
| `UPSTREAM_ERROR` | 502 | 上游服务错误响应，或非超时的网络错误 |
| `SUBMISSION_TIMEOUT` | 503 | 提交或运行轮询 20 次仍未有终态（P1 已实现） |
| `UPSTREAM_TIMEOUT` | 504 | 连接/响应超时 |

所有 `message` 都是固定文案，不包含异常消息、上游 body、堆栈或 Cookie 内容；
`GlobalExceptionHandler` 的映射与 MockMvc 测试见 §4.7。

---

## 10. 错误处理规范

### Cookie 缺失 / 过期检测
`LeetCodeClient` 在本地没有 Cookie 时抛出 `CookieMissingException`，`GlobalExceptionHandler`
返回 401 `COOKIE_MISSING`；上游返回 401 时抛出 `WebClientResponseException`，返回 401
`COOKIE_EXPIRED`。错误随题目请求返回，由题目面板显示；用户可从面板的“题库登录”入口更新 Cookie。应用启动和浏览其他平台不会因 LeetCode Cookie 缺失而阻断。

### 频率限制（429）
LeetCode 对频繁请求有限流。处理方式：
1. 返回 429 `RATE_LIMITED` 给前端，提示"请稍后再试"
2. 后续可加 Redis 本地限速（每分钟最多 20 次 GraphQL 请求），题目命中缓存则不计入

### 网络超时
LeetCode 和常规网关请求的 `WebClient` 连接超时 5s、响应超时 15s；Agent 聊天代理单独使用
120s WebClient 响应超时和 125s Spring MVC 异步请求超时，以容纳模型生成，并确保请求期限
长于上游网络期限。超时（cause 链含 `TimeoutException`）由
`GlobalExceptionHandler` 返回 504 `UPSTREAM_TIMEOUT`；非超时的网络错误返回 502
`UPSTREAM_ERROR`。

### 参数校验与兜底
`@Valid` 请求体校验失败（`MethodArgumentNotValidException`）或 JSON 无法解析
（`HttpMessageNotReadableException`）返回 400 `VALIDATION_ERROR`。其余未预期异常返回
500 `INTERNAL_ERROR`，响应中只有固定文案，异常细节仅写服务端日志。

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
    <groupId>io.projectreactor</groupId>
    <artifactId>reactor-test</artifactId>
    <scope>test</scope>
</dependency>
```

无需额外 WireMock/MockWebServer：`LeetCodeClientRestTest` 和
`AgentProxyControllerTest` 用 WebClient 的 `ExchangeFunction` 捕获出站请求，
`SubmissionServiceTest` 使用 fake client + Reactor 虚拟时间。测试不访问真实 LeetCode
或 Python 服务，也不会真的等待 30 秒轮询窗口。`FullFlowIT` 用 `@SpringBootTest` 加载
真实 MVC/JPA 链路，临时 SQLite 文件 + fake `ExchangeFunction`，第一次 check 即返回
终态，因此只产生一次轮询（约 1.5s），同样不等待 30 秒预算，也不读取
`data/algocoach.db`。

### 测试重点

```
src/test/java/com/algocoach/
├── config/
│   ├── CorsConfigTest.java          # 已实现：preflight / origin 白名单 / 路径范围 / 403
│   ├── StaticResourceConfigTest.java # 已实现：临时目录 + MockMvc，MP4/MIME/404/../阻断/Range
│   └── WebClientConfigTest.java     # 已实现：Builder 单例 + 5s/15s 超时 + 自动配置无冲突
├── model/
│   ├── ProblemCacheTest.java        # 已实现：24h TTL 边界（23h / 24h / 24h+1ms）
│   ├── ProblemCacheSchemaTest.java  # 已实现：cached_at 索引声明与 ddl-auto 建索引
│   ├── SubmissionRecordTest.java    # 已实现：表名/索引/列映射/非空与可空
│   └── SubmissionRecordPersistenceTest.java # 已实现：SQLite 持久化/UUID/NOT NULL
├── repository/
│   └── SubmissionRepositoryTest.java # 已实现：problemId 过滤 + createdAt 倒序 + Pageable limit
├── client/
│   └── LeetCodeClientRestTest.java  # 已实现：fake ExchangeFunction 断言 REST GET/POST 路径、
│                                    #   typed_code/lang/question_id body、Cookie/CSRF/Referer
├── service/
│   ├── ProblemCacheServiceTest.java # 已实现：23h 命中无上游 / miss 写入 / 25h 过期刷新
│   └── SubmissionServiceTest.java   # 已实现：缓存 questionId、PENDING→SUCCESS、
│                                    #   COMPILE_ERROR / RUNTIME_ERROR 终态、超时、记录保存、
│                                    #   run 输入回退/原样返回/超时不写记录、history 过滤/limit
├── exception/
│   └── GlobalExceptionHandlerTest.java # 已实现：MockMvc 400/401/429/502/503/504/500 + 不泄漏
├── controller/
│   ├── ProblemControllerTest.java   # 已实现：仅 bySlug 走缓存，list/daily 仍走 ProblemService
│   ├── AuthControllerTest.java      # 已实现：MockMvc 存储 session/csrf、status 有/无、
│   │                                #   blank/missing/malformed → VALIDATION_ERROR、不回显秘密
│   ├── AgentProxyControllerTest.java # 已实现：七条代理路由 + query/body/header 透明传递
│   └── SubmissionControllerTest.java # 已实现：MockMvc run/submit/history、@Valid、limit<=0
└── integration/
    └── FullFlowIT.java              # 已实现：临时 SQLite + 真实 MVC + fake ExchangeFunction，
                                     #   一次终态轮询，DTO/记录/createdAt/history 全字段
```

P1 实际运行的聚焦用例（`SubmissionServiceTest` / `SubmissionControllerTest`）：

- `pendingThenAcceptedPollsToTerminalAndSavesCompleteRecord`：缓存 questionId 传入提交 body；
  前两次 `PENDING`、第三次 `SUCCESS`；校验 runtime/memory/通过数映射、完整记录字段、
  `createdAt` 为规范 UTC ISO-8601。
- `compileErrorIsTerminalAndSavedWithoutPollingAgain`：`COMPILE_ERROR` 一次即终态，
  保存 `compile_error`。
- `runtimeErrorIsTerminalAndSaved`：`RUNTIME_ERROR` 终态，保存 `runtime_error`。
- `exhaustedPollingThrowsTimeoutAndNeverSaves`：虚拟时间推进 31s，恰好轮询 20 次后抛
  `SubmissionTimeoutException`，`SubmissionRepository.save` 从未调用。
- `mapsLeetCodeStatusMessagesToCanonicalStatuses`：`status_msg` 的 Accepted / Wrong Answer /
  Time Limit Exceeded / Memory Limit Exceeded / Runtime Error / Compile Error 规范化，
  缺失时回退 `state`。
- `runUsesCustomTestInputAndReturnsRawJsonWithoutSaving`：`testInput` 覆盖 `sampleTestCase`，
  `interpret_solution` body 含 `typed_code/lang/question_id/data_input`；两次 `PENDING` 后
  `SUCCESS`，返回原始 JSON 且 `SubmissionRepository` 零交互。
- `runFallsBackToCachedSampleTestCaseWhenTestInputIsBlank`：空白 `testInput` 使用缓存
  `sampleTestCase`。
- `runPollingExhaustionTimesOutWithoutSaving`：run 同样在 20 次后抛
  `SubmissionTimeoutException`，不写记录。
- `historyAppliesProblemFilterAndLimitThroughPageable` /
  `historyWithoutProblemQueriesAllRowsNewestFirst`：`problemId` 过滤与不传筛选分别命中
  repository 的 Pageable 派生查询，`page=0`、`size=limit`。
- `historyRejectsNonPositiveLimit`：`limit=0` / 负数抛 `InvalidLimitException`，不访问 repository。
- `SubmissionControllerTest`：MockMvc 验证 `/api/run` 返回原始 JSON、`/api/submit` 的
  `@Valid` 校验与既有 service 调用、`/api/submissions` 默认 limit=20 / 显式过滤 /
  `limit=0` → 400 `VALIDATION_ERROR`。
- `SubmissionRepositoryTest` 新增两个 Pageable 用例：25 条数据中精确返回最新 10 条，
  以及不带 problemId 时精确返回最新 4 条。

`GlobalExceptionHandlerTest` 增加一个仅测试用的探针端点，通过真实 MVC 分派验证
`SubmissionTimeoutException` → 503 `SUBMISSION_TIMEOUT` 的统一 `ErrorResponse`。

P2 实际运行的聚焦用例（`AgentProxyControllerTest`，fake `ExchangeFunction` + MockMvc，
不访问真实 Python 服务）：

- `postRoutesForwardToTheirFixedUpstreamPath`（参数化）：`/chat`、`/memory/record`、
  `/animate`、`/animate/generated` 分别以 POST 转发到同名上游路径。
- `getAnimateStatusForwardsJobIdAndQueryString`：GET `/api/agent/animate/job-42?verbose=true`
  转发为 `/animate/job-42`，路径参数与原始 query 均保留。
- `preservesQueryBodyContentTypeAndAuthorizationWhileDroppingOtherHeaders`：原始 query
  （含 `%20`）与 body 字节原样到达上游；只带 `Content-Type` / `Authorization`，
  `Cookie` / `Connection` / `X-Forwarded-For` 不转发；上游固定为配置的 host:port。
- `generatedAnimationPassesBearerTokenToTheUpstream`：`/animate/generated` 的 Bearer token
  原样转发。
- `unauthorizedResponseIsPassedThroughWithAuthenticationHeader` /
  `rateLimitedResponseIsPassedThroughWithRetryAfter` /
  `serviceUnavailableResponseIsPassedThrough`：401 / 429 / 503 的 status、body 以及
  `WWW-Authenticate` / `Retry-After` 均透明返回，不被 `GlobalExceptionHandler` 改写。
- `upstreamUnreachableMapsToGatewayUpstreamError`：fake `WebClientRequestException`
  经统一异常处理返回 502 `UPSTREAM_ERROR`。
- `requestCannotOverrideTheConfiguredBaseUrl`：query 参数伪造 `baseUrl` / `agent.base-url`
  不改变上游 host:port；带尾斜杠的配置被规范化。
- `getMemoryProfileForwardsToTheFixedAgentRoute`：验证 `/memory/profile` 固定代理；`getMemoryExportForwardsToTheFixedAgentRoute`：验证 `/memory/export` 固定代理
  不会产生任何出站请求（当前不存在该 FastAPI 路由）。

P2 静态资源聚焦用例（`StaticResourceConfigTest`，`@WebMvcTest` + `@TempDir` + 动态属性，
不读取仓库真实 `data/animations`）：

- `configuredLocationIsResolvedAndUsed`：`animations.location` 指向临时目录，规范化后
  `file:` URI 以 `/` 结尾，handler 使用的正是该位置。
- `servesMp4FromConfiguredDirectoryAsVideoMp4`：合法 MP4 返回 200、`video/mp4`、正确
  `Content-Length` 与原始字节。
- `missingFileReturnsNotFound`：缺失文件返回 404 `NOT_FOUND`。
- `dotDotTraversalCannotReadFileOutsideConfiguredDirectory`：`../outside.mp4`、
  `%2e%2e/outside.mp4`、`..%2Foutside.mp4` 均不能读取临时根目录外的文件。
- `rangeRequestReturnsPartialContent`：`Range: bytes=0-3` 返回 206、`Accept-Ranges: bytes`、
  `Content-Range: bytes 0-3/N` 和对应片段。
- `normalizeAddsTrailingSlashAndResolvesRelativeAgainstWorkingDirectory` /
  `normalizeCollapsesDotDotInAbsoluteLocations` /
  `normalizeRejectsBlankAndNonFileLocations`：相对路径按工作目录解析、绝对路径中的
  `..` 被折叠、末尾斜杠补齐；空值、非 `file:` 配置和远端 `file://host` 启动时拒绝。

P3 实际运行的聚焦用例（`AuthControllerTest` / `FullFlowIT`）：

- `AuthControllerTest`（`@WebMvcTest`，mock `UserCookieRepository`）：
  `saveCookieStoresSessionAndCsrfForTheDefaultUser` 捕获保存的 `UserCookie`，断言
  `userId=default`、session/csrf 原值、`updatedAt` 落在请求窗口内；
  `saveCookieReturnsNoBodyAndNeverEchoesTheSecrets` 断言 200 空响应且响应中不含
  session/csrf；`statusReportsAuthenticatedWhenTheCookieExists` /
  `statusReportsUnauthenticatedWhenNoCookieExists` 覆盖有/无 cookie 的
  `{"authenticated":...}`；blank session、blank csrf、缺字段、非法 JSON、空 body 五类
  输入统一返回 400 `VALIDATION_ERROR` 且不写库。
- `FullFlowIT.submitThroughRealMvcPersistsCompleteRecordAndMakesHistoryReadable`
  （`@SpringBootTest` + `@AutoConfigureMockMvc`）：经真实 `POST /api/auth/cookie` 写入
  仅测试 Cookie，再 `POST /api/submit`；fake `ExchangeFunction` 返回
  `submission_id=123` 和第一次 check 的 `SUCCESS/Accepted`，断言出站恰好两次请求
  （POST `/problems/two-sum/submit/`、GET `/submissions/detail/123/check/`）、方法/路径/
  body/Cookie/CSRF/Referer，响应 DTO 的 8 个字段，`SubmissionRecord` 的
  id/problemId/platform/status/lang/code/runtimeMs/memoryMb/durationSec/createdAt，
  以及 `GET /api/submissions` 可读回同一记录；整段耗时断言 <10s（实际一次 1.5s 轮询）。
- `FullFlowIT.submitWithoutStoredCookieReturns401WithoutUpstreamCallOrRecord`：没有
  Cookie 时 401 `COOKIE_MISSING`，零出站请求、零记录。
- 隔离性：`@DynamicPropertySource` 把 `spring.datasource.url` 指向临时目录的 SQLite
  文件（测试中断言该 URL），`animations.location` 也指向临时目录；不触碰
  `data/algocoach.db`，也不访问真实 LeetCode/Python。
- `mvn test` 通过 Surefire 的 `**/*IT.java` include 执行 `FullFlowIT`；否则 Maven 默认
  只跑 `*Test`，该集成测试会被静默跳过。

验证命令：

```bash
cd backend/gateway
docker run --rm -v "$PWD:/workspace" -w /workspace maven:3.9.9-eclipse-temurin-21 mvn -B clean test
```

当前 104 个测试全部通过（`mvn -B clean test`，包含 P2 新增的 13 个代理用例与 8 个静态
资源用例，以及 P3 新增的 9 个 Cookie 用例与 2 个全链路集成用例；Surefire 已把
`**/*IT.java` 纳入 `mvn test`）。

---

## 12. 实现优先级

| 优先级 | 任务 | 预估工时 |
|--------|------|---------|
| P0 | ✅ `CorsConfig` + `WebClientConfig`（含聚焦测试） | 0.5h |
| P0 | ✅ `ProblemCache` 实体 + `ProblemCacheService`（24h TTL，含命中/miss/过期测试） | 2h |
| P0 | ✅ `GlobalExceptionHandler`（统一错误响应 + MockMvc 测试） | 1h |
| P1 | ✅ `SubmissionRecord` 实体 + Repository（SQLite 持久化/UUID/约束/派生查询测试） | 1h |
| P1 | ✅ `SubmissionService` + DTO（提交 + 轮询 + 记录保存 + run/history + 聚焦测试） | 5h |
| P1 | ✅ `SubmissionController` + `RunRequest`（run/submit/history，MockMvc 测试） | 1.5h |
| P2 | ✅ `AgentProxyController`（七条实际路由 + 透明状态/body/头 + 聚焦测试） | 1h |
| P2 | ✅ `StaticResourceConfig`（只读 `/animations/**` + 可配置位置 + 404/Range 聚焦测试） | 0.5h |
| P3 | ✅ 单元测试 + 集成测试（`AuthControllerTest` 9 + `FullFlowIT` 2，全套 104 通过） | 4h |
