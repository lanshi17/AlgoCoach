package com.algocoach.client;

import com.algocoach.exception.CookieMissingException;
import com.algocoach.model.UserCookie;
import com.algocoach.repository.UserCookieRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.http.client.reactive.MockClientHttpRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Verifies the REST transport added for submissions without touching LeetCode: a
 * fake {@code ExchangeFunction} captures the outgoing request, so the path, JSON body
 * and the Cookie / CSRF / Referer headers can be asserted directly.
 */
@ExtendWith(MockitoExtension.class)
class LeetCodeClientRestTest {

    private static final String BASE_URL = "https://leetcode.cn";
    private static final String SESSION = "session-value";
    private static final String CSRF = "csrf-value";

    @Mock
    private UserCookieRepository cookieRepo;

    private final ObjectMapper mapper = new ObjectMapper();
    private final AtomicReference<MockClientHttpRequest> captured = new AtomicReference<>();
    private final AtomicReference<String> responseBody = new AtomicReference<>("{}");

    private LeetCodeClient client;

    @BeforeEach
    void setUp() {
        when(cookieRepo.findById(LeetCodeClient.DEFAULT_USER_ID))
                .thenReturn(Optional.of(new UserCookie("default", SESSION, CSRF, 0L)));

        WebClient.Builder builder = WebClient.builder().exchangeFunction(request -> {
            MockClientHttpRequest mock = new MockClientHttpRequest(request.method(), request.url());
            captured.set(mock);
            return request.writeTo(mock, ExchangeStrategies.withDefaults())
                    .thenReturn(ClientResponse.create(HttpStatus.OK)
                            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                            .body(responseBody.get())
                            .build());
        });

        client = new LeetCodeClient(cookieRepo, builder);
        ReflectionTestUtils.setField(client, "baseUrl", BASE_URL);
        ReflectionTestUtils.setField(client, "graphqlPath", "/graphql");
    }

    @Test
    void postSendsSubmitPathJsonBodyAndCookieHeaders() throws Exception {
        responseBody.set("{\"submission_id\":123}");

        StepVerifier.create(client.post("/problems/two-sum/submit/", Map.of(
                        "typed_code", "fn main() {}",
                        "lang", "rust",
                        "question_id", "1")))
                .expectNext("{\"submission_id\":123}")
                .verifyComplete();

        MockClientHttpRequest request = captured.get();
        assertThat(request.getMethod()).isEqualTo(HttpMethod.POST);
        assertThat(request.getURI().getPath()).isEqualTo("/problems/two-sum/submit/");
        assertCookieHeaders(request);

        JsonNode body = mapper.readTree(request.getBodyAsString().block());
        assertThat(body.path("typed_code").asText()).isEqualTo("fn main() {}");
        assertThat(body.path("lang").asText()).isEqualTo("rust");
        assertThat(body.path("question_id").asText()).isEqualTo("1");
    }

    @Test
    void getSendsPollingPathAndCookieHeaders() {
        responseBody.set("{\"state\":\"PENDING\"}");

        StepVerifier.create(client.get("/submissions/detail/123/check/"))
                .expectNext("{\"state\":\"PENDING\"}")
                .verifyComplete();

        MockClientHttpRequest request = captured.get();
        assertThat(request.getMethod()).isEqualTo(HttpMethod.GET);
        assertThat(request.getURI().getPath()).isEqualTo("/submissions/detail/123/check/");
        assertCookieHeaders(request);
    }

    @Test
    void graphqlMethodIsRetainedWithSameCookieHeaders() {
        responseBody.set("{\"data\":{\"question\":{}}}");

        StepVerifier.create(client.graphql("query questionData { question { title } }", Map.of()))
                .expectNext("{\"data\":{\"question\":{}}}")
                .verifyComplete();

        MockClientHttpRequest request = captured.get();
        assertThat(request.getMethod()).isEqualTo(HttpMethod.POST);
        assertThat(request.getURI().getPath()).isEqualTo("/graphql");
        assertCookieHeaders(request);
        String body = request.getBodyAsString().block();
        assertThat(body).contains("query questionData").contains("\"variables\":{}");
    }

    @Test
    void missingCookieFailsBeforeAnyRequest() {
        when(cookieRepo.findById(LeetCodeClient.DEFAULT_USER_ID)).thenReturn(Optional.empty());

        StepVerifier.create(client.get("/submissions/detail/123/check/"))
                .expectError(CookieMissingException.class)
                .verify();

        assertThat(captured.get()).isNull();
    }

    private static void assertCookieHeaders(MockClientHttpRequest request) {
        HttpHeaders headers = request.getHeaders();
        assertThat(headers.getFirst(HttpHeaders.COOKIE))
                .isEqualTo("LEETCODE_SESSION=" + SESSION + "; csrftoken=" + CSRF);
        assertThat(headers.getFirst("x-csrftoken")).isEqualTo(CSRF);
        assertThat(headers.getFirst("Referer")).isEqualTo(BASE_URL + "/");
    }
}
