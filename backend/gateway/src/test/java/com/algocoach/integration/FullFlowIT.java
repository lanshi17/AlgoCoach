package com.algocoach.integration;

import com.algocoach.model.ProblemCache;
import com.algocoach.model.SubmissionRecord;
import com.algocoach.model.UserCookie;
import com.algocoach.repository.ProblemCacheRepository;
import com.algocoach.repository.SubmissionRepository;
import com.algocoach.repository.UserCookieRepository;
import com.algocoach.dto.MemoryRecordRequest;
import com.algocoach.service.AgentMemoryClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.http.client.reactive.MockClientHttpRequest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.ExchangeFunction;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Full submit flow through the real Spring Boot MVC stack.
 *
 * <p>The real {@code AuthController}, {@code SubmissionController},
 * {@code SubmissionService}, JPA repositories and {@code GlobalExceptionHandler} are
 * used against a temporary SQLite file. The LeetCode HTTP exchange is faked, and the
 * memory callback is mocked, so no real LeetCode or Python service is contacted.</p>
 *
 * <p>The fake upstream answers the submit call and the first check call with a terminal
 * {@code SUCCESS}, so the whole flow performs exactly one poll (one 1.5s delay) instead
 * of waiting out the 20 x 1.5s budget. No real LeetCode or Python service is contacted,
 * and the repository {@code data/algocoach.db} is never opened.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(FullFlowIT.FakeLeetCodeConfiguration.class)
class FullFlowIT {

    private static final String SLUG = "two-sum";
    private static final String QUESTION_ID = "1";
    private static final String CODE = "print(3)";
    private static final int DURATION_SEC = 240;
    private static final String SESSION = "it-only-leetcode-session";
    private static final String CSRF = "it-only-csrf-token";

    private static final String SUBMIT_PATH = "/problems/" + SLUG + "/submit/";
    private static final String CHECK_PATH = "/submissions/detail/123/check/";

    private static final String ACCEPTED_JSON = """
            {"state":"SUCCESS","status_msg":"Accepted","status_runtime":"3 ms",
             "memory":3145728,"total_correct":73,"total_testcases":73,
             "compile_error":"","runtime_error":""}
            """;

    private static final String SUBMIT_BODY = """
            {"titleSlug":"two-sum","code":"print(3)","lang":"python3","durationSec":240}
            """;

    private static final Path TEMP_DIRECTORY = temporaryDirectory();
    private static final Path DB_PATH = TEMP_DIRECTORY.resolve("full-flow.db");
    private static final Path ANIMATIONS_DIR = TEMP_DIRECTORY.resolve("animations");
    private static final FakeLeetCodeExchange LEETCODE = new FakeLeetCodeExchange();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SubmissionRepository submissionRepository;

    @Autowired
    private UserCookieRepository cookieRepository;

    @Autowired
    private ProblemCacheRepository problemCacheRepository;

    @Autowired
    private ObjectMapper mapper;

    @MockBean
    private AgentMemoryClient agentMemoryClient;

    @Value("${spring.datasource.url}")
    private String datasourceUrl;

    @DynamicPropertySource
    static void gatewayProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> "jdbc:sqlite:" + DB_PATH);
        registry.add("animations.location", () -> ANIMATIONS_DIR.toUri().toString());
    }

    @BeforeEach
    void resetState() {
        submissionRepository.deleteAll();
        cookieRepository.deleteAll();
        problemCacheRepository.deleteAll();
        LEETCODE.reset();
        when(agentMemoryClient.record(any())).thenReturn(Mono.empty());

        // A fresh cache hit means the flow never needs a GraphQL problem lookup.
        problemCacheRepository.save(new ProblemCache(SLUG, """
                {"questionId":"1","titleSlug":"two-sum","sampleTestCase":"1 2",
                 "topicTags":[{"name":"Array","nameTranslated":"数组"}]}
                """, System.currentTimeMillis()));
    }

    @Test
    void submitThroughRealMvcPersistsCompleteRecordAndMakesHistoryReadable() throws Exception {
        assertThat(datasourceUrl)
                .as("integration test must use its own temporary SQLite file")
                .isEqualTo("jdbc:sqlite:" + DB_PATH);

        storeTestCookie();

        long started = System.nanoTime();
        MvcResult asyncResult = mockMvc.perform(post("/api/submit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SUBMIT_BODY))
                .andExpect(request().asyncStarted())
                .andReturn();
        String responseBody = mockMvc.perform(asyncDispatch(asyncResult))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andReturn()
                .getResponse()
                .getContentAsString();
        Duration elapsed = Duration.ofNanos(System.nanoTime() - started);
        assertThat(elapsed)
                .as("one immediate terminal poll must not wait for the 30s polling budget")
                .isLessThan(Duration.ofSeconds(10));

        JsonNode dto = mapper.readTree(responseBody);
        assertThat(dto.path("id").asText()).isEqualTo("123");
        assertThat(dto.path("status").asText()).isEqualTo("ACCEPTED");
        assertThat(dto.path("runtimeMs").asInt()).isEqualTo(3);
        assertThat(dto.path("memoryMb").asInt()).isEqualTo(3);
        assertThat(dto.path("passedTests").asInt()).isEqualTo(73);
        assertThat(dto.path("totalTests").asInt()).isEqualTo(73);
        assertThat(dto.get("errorMessage").isNull()).isTrue();
        assertThat(dto.path("durationSec").asInt()).isEqualTo(DURATION_SEC);

        List<CapturedRequest> upstream = LEETCODE.requests();
        assertThat(upstream)
                .as("one submit call and exactly one terminal check call")
                .hasSize(2);

        CapturedRequest submit = upstream.get(0);
        assertThat(submit.method()).isEqualTo(HttpMethod.POST.name());
        assertThat(submit.path()).isEqualTo(SUBMIT_PATH);
        assertThat(submit.cookie())
                .isEqualTo("LEETCODE_SESSION=" + SESSION + "; csrftoken=" + CSRF);
        assertThat(submit.csrfHeader()).isEqualTo(CSRF);
        assertThat(submit.referer()).isEqualTo("https://leetcode.cn/");
        JsonNode submittedBody = mapper.readTree(submit.body());
        assertThat(submittedBody.path("typed_code").asText()).isEqualTo(CODE);
        assertThat(submittedBody.path("lang").asText()).isEqualTo("python3");
        assertThat(submittedBody.path("question_id").asText()).isEqualTo(QUESTION_ID);

        CapturedRequest poll = upstream.get(1);
        assertThat(poll.method()).isEqualTo(HttpMethod.GET.name());
        assertThat(poll.path()).isEqualTo(CHECK_PATH);
        assertThat(poll.cookie())
                .isEqualTo("LEETCODE_SESSION=" + SESSION + "; csrftoken=" + CSRF);

        List<SubmissionRecord> records = submissionRepository.findAll();
        assertThat(records).hasSize(1);
        SubmissionRecord record = records.get(0);
        assertThat(record.getId()).isNotNull();
        assertThat(UUID.fromString(record.getId())).hasToString(record.getId());
        assertThat(record.getProblemId()).isEqualTo(QUESTION_ID);
        assertThat(record.getPlatform()).isEqualTo("LEETCODE");
        assertThat(record.getStatus()).isEqualTo("ACCEPTED");
        assertThat(record.getLang()).isEqualTo("python3");
        assertThat(record.getCode()).isEqualTo(CODE);
        assertThat(record.getRuntimeMs()).isEqualTo(3);
        assertThat(record.getMemoryMb()).isEqualTo(3);
        assertThat(record.getDurationSec()).isEqualTo(DURATION_SEC);

        verify(agentMemoryClient).record(new MemoryRecordRequest(
                SLUG, "LEETCODE", "ACCEPTED", "python3", DURATION_SEC, List.of("数组")));

        Instant createdAt = Instant.parse(record.getCreatedAt());
        assertThat(createdAt.toString()).isEqualTo(record.getCreatedAt());
        Instant now = Instant.now();
        assertThat(createdAt).isBetween(now.minusSeconds(30), now.plusSeconds(1));

        mockMvc.perform(get("/api/submissions")
                        .param("problemId", QUESTION_ID)
                        .param("limit", "5"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(record.getId()))
                .andExpect(jsonPath("$[0].problemId").value(QUESTION_ID))
                .andExpect(jsonPath("$[0].platform").value("LEETCODE"))
                .andExpect(jsonPath("$[0].status").value("ACCEPTED"))
                .andExpect(jsonPath("$[0].lang").value("python3"))
                .andExpect(jsonPath("$[0].code").value(CODE))
                .andExpect(jsonPath("$[0].runtimeMs").value(3))
                .andExpect(jsonPath("$[0].memoryMb").value(3))
                .andExpect(jsonPath("$[0].durationSec").value(DURATION_SEC))
                .andExpect(jsonPath("$[0].createdAt").value(record.getCreatedAt()));
    }

    @Test
    void submitWithoutStoredCookieReturns401WithoutUpstreamCallOrRecord() throws Exception {
        mockMvc.perform(get("/api/auth/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(false));

        MvcResult asyncResult = mockMvc.perform(post("/api/submit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SUBMIT_BODY))
                .andExpect(request().asyncStarted())
                .andReturn();

        mockMvc.perform(asyncDispatch(asyncResult))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("COOKIE_MISSING"));

        assertThat(LEETCODE.requests()).isEmpty();
        assertThat(submissionRepository.count()).isZero();
    }

    private void storeTestCookie() throws Exception {
        mockMvc.perform(post("/api/auth/cookie")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"session":"it-only-leetcode-session",
                                 "csrf":"it-only-csrf-token"}
                                """))
                .andExpect(status().isOk())
                .andExpect(content().string(""));

        UserCookie stored = cookieRepository.findById("default").orElseThrow();
        assertThat(stored.getSession()).isEqualTo(SESSION);
        assertThat(stored.getCsrf()).isEqualTo(CSRF);

        mockMvc.perform(get("/api/auth/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(true));
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class FakeLeetCodeConfiguration {

        @Bean
        @Primary
        WebClient.Builder fullFlowWebClientBuilder() {
            return WebClient.builder().exchangeFunction(LEETCODE);
        }
    }

    /**
     * Captures every outbound LeetCode request instead of sending it. Unrecognized
     * requests answer 500, so an accidental extra call fails the test rather than
     * reaching the network.
     */
    static final class FakeLeetCodeExchange implements ExchangeFunction {

        private final List<CapturedRequest> requests = new CopyOnWriteArrayList<>();

        @Override
        public Mono<ClientResponse> exchange(ClientRequest request) {
            MockClientHttpRequest captured =
                    new MockClientHttpRequest(request.method(), request.url());
            return request.writeTo(captured, ExchangeStrategies.withDefaults())
                    .then(Mono.fromSupplier(() -> {
                        String body = captured.getBodyAsString().block(Duration.ofSeconds(1));
                        requests.add(new CapturedRequest(
                                request.method().name(),
                                request.url().getPath(),
                                captured.getHeaders(),
                                body == null ? "" : body));
                        return response(request.method().name(), request.url().getPath());
                    }));
        }

        List<CapturedRequest> requests() {
            return List.copyOf(requests);
        }

        void reset() {
            requests.clear();
        }

        private static ClientResponse response(String method, String path) {
            if (HttpMethod.POST.matches(method) && SUBMIT_PATH.equals(path)) {
                return json(HttpStatus.OK, "{\"submission_id\":123}");
            }
            if (HttpMethod.GET.matches(method) && CHECK_PATH.equals(path)) {
                return json(HttpStatus.OK, ACCEPTED_JSON);
            }
            return json(HttpStatus.INTERNAL_SERVER_ERROR,
                    "{\"error\":\"unexpected upstream request\"}");
        }

        private static ClientResponse json(HttpStatus status, String body) {
            return ClientResponse.create(status)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .body(body)
                    .build();
        }
    }

    record CapturedRequest(String method, String path, HttpHeaders headers, String body) {

        String cookie() {
            return headers.getFirst(HttpHeaders.COOKIE);
        }

        String csrfHeader() {
            return headers.getFirst("x-csrftoken");
        }

        String referer() {
            return headers.getFirst("Referer");
        }
    }

    private static Path temporaryDirectory() {
        try {
            Path directory = Files.createTempDirectory("gateway-full-flow");
            Files.createDirectories(directory.resolve("animations"));
            directory.toFile().deleteOnExit();
            return directory;
        } catch (IOException e) {
            throw new IllegalStateException("Could not prepare the integration test directory", e);
        }
    }
}
