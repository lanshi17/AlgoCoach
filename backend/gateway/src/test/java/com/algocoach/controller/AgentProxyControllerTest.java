package com.algocoach.controller;

import com.algocoach.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.http.client.reactive.MockClientHttpRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import reactor.core.publisher.Mono;

import java.net.ConnectException;
import java.net.URI;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Focused coverage for {@link AgentProxyController} without any network access.
 *
 * <p>A fake {@code ExchangeFunction} captures the outgoing request, so the upstream
 * method, URI (including the raw query string), body and forwarded headers can be
 * asserted directly, and the canned upstream response proves that status, body and
 * the meaningful response headers are passed through unchanged. Only the agent base
 * URL is configured (with a trailing slash, to cover normalization); nothing ever
 * connects to a real Python service.</p>
 */
class AgentProxyControllerTest {

    private static final String BASE_URL = "http://agent.internal:8000";
    private static final String PREFIX = AgentProxyController.BASE_PATH;

    private final AtomicReference<MockClientHttpRequest> captured = new AtomicReference<>();
    private final AtomicReference<ClientResponse> upstreamResponse = new AtomicReference<>();
    private final AtomicReference<Throwable> upstreamFailure = new AtomicReference<>();

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        WebClient.Builder builder = WebClient.builder().exchangeFunction(request -> {
            MockClientHttpRequest mock = new MockClientHttpRequest(request.method(), request.url());
            captured.set(mock);
            return request.writeTo(mock, ExchangeStrategies.withDefaults())
                    .then(Mono.defer(() -> {
                        ClientResponse response = upstreamResponse.get();
                        if (response != null) {
                            return Mono.just(response);
                        }
                        return Mono.error(upstreamFailure.get());
                    }));
        });

        mockMvc = MockMvcBuilders
                .standaloneSetup(new AgentProxyController(builder, BASE_URL + "/"))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/chat/stream",
            "/chat/replay",
            "/memory/record",
            "/animate",
            "/animate/generated"
    })
    void postRoutesForwardToTheirFixedUpstreamPath(String path) throws Exception {
        upstreamResponse.set(jsonResponse(HttpStatus.OK, "{}"));

        performAsync(post(PREFIX + path)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"hi\"}"))
                .andExpect(status().isOk());

        assertThat(captured.get().getMethod()).isEqualTo(HttpMethod.POST);
        assertThat(captured.get().getURI().getPath()).isEqualTo(path);
    }

    @Test
    void getAnimateStatusForwardsJobIdAndQueryString() throws Exception {
        upstreamResponse.set(jsonResponse(HttpStatus.OK, "{\"status\":\"done\"}"));

        performAsync(get(PREFIX + "/animate/job-42").queryParam("verbose", "true"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value("done"));

        MockClientHttpRequest request = captured.get();
        assertThat(request.getMethod()).isEqualTo(HttpMethod.GET);
        assertThat(request.getURI().getPath()).isEqualTo("/animate/job-42");
        assertThat(request.getURI().getRawQuery()).isEqualTo("verbose=true");
    }

    @Test
    void getMemoryProfileForwardsToTheFixedAgentRoute() throws Exception {
        upstreamResponse.set(jsonResponse(HttpStatus.OK, "{\"topics\":[],\"edges\":[]}"));

        performAsync(get(PREFIX + "/memory/profile"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.topics").isEmpty());

        assertThat(captured.get().getMethod()).isEqualTo(HttpMethod.GET);
        assertThat(captured.get().getURI().getPath()).isEqualTo("/memory/profile");
    }

    @Test
    void getMemoryExportForwardsToTheFixedAgentRoute() throws Exception {
        upstreamResponse.set(jsonResponse(HttpStatus.OK, "{}"));

        performAsync(get(PREFIX + "/memory/export"))
                .andExpect(status().isOk())
                .andExpect(content().string("{}"));

        assertThat(captured.get().getMethod()).isEqualTo(HttpMethod.GET);
        assertThat(captured.get().getURI().getPath()).isEqualTo("/memory/export");
    }

    @Test
    void preservesQueryBodyContentTypeAndAuthorizationWhileDroppingOtherHeaders() throws Exception {
        upstreamResponse.set(jsonResponse(HttpStatus.OK, "{\"content\":\"hello\"}"));

        performAsync(post(PREFIX + "/chat/stream")
                .queryParam("mode", "focus")
                .queryParam("problemId", "two sum")
                .header(HttpHeaders.AUTHORIZATION, "Bearer token-1")
                .header(HttpHeaders.COOKIE, "LEETCODE_SESSION=secret")
                .header(HttpHeaders.CONNECTION, "keep-alive")
                .header("X-Forwarded-For", "203.0.113.9")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"hello\"}"))
                .andExpect(status().isOk())
                .andExpect(content().string("{\"content\":\"hello\"}"));

        MockClientHttpRequest request = captured.get();
        assertThat(request.getMethod()).isEqualTo(HttpMethod.POST);
        assertThat(request.getURI().getPath()).isEqualTo("/chat/stream");
        assertThat(request.getURI().getRawQuery())
                .isEqualTo("mode=focus&problemId=two%20sum");
        assertThat(request.getURI().getHost()).isEqualTo("agent.internal");
        assertThat(request.getURI().getPort()).isEqualTo(8000);
        assertThat(request.getHeaders().getFirst(HttpHeaders.CONTENT_TYPE))
                .startsWith(MediaType.APPLICATION_JSON_VALUE);
        assertThat(request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION))
                .isEqualTo("Bearer token-1");
        assertThat(request.getHeaders().getFirst(HttpHeaders.COOKIE)).isNull();
        assertThat(request.getHeaders().getFirst(HttpHeaders.CONNECTION)).isNull();
        assertThat(request.getHeaders().getFirst("X-Forwarded-For")).isNull();
        assertThat(request.getBodyAsString().block()).isEqualTo("{\"message\":\"hello\"}");
    }

    @Test
    void generatedAnimationPassesBearerTokenToTheUpstream() throws Exception {
        upstreamResponse.set(jsonResponse(HttpStatus.OK, "{\"job_id\":\"gen-1\"}"));

        performAsync(post(PREFIX + "/animate/generated")
                .header(HttpHeaders.AUTHORIZATION, "Bearer codegen-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"demo\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.job_id").value("gen-1"));

        assertThat(captured.get().getHeaders().getFirst(HttpHeaders.AUTHORIZATION))
                .isEqualTo("Bearer codegen-token");
    }

    @Test
    void unauthorizedResponseIsPassedThroughWithAuthenticationHeader() throws Exception {
        upstreamResponse.set(upstream(HttpStatus.UNAUTHORIZED,
                "{\"detail\":{\"code\":\"Unauthorized\",\"reason\":\"invalid_token\"}}",
                Map.of(HttpHeaders.WWW_AUTHENTICATE, "Bearer")));

        performAsync(post(PREFIX + "/animate/generated")
                .header(HttpHeaders.AUTHORIZATION, "Bearer wrong")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, "Bearer"))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.detail.reason").value("invalid_token"));
    }

    @Test
    void rateLimitedResponseIsPassedThroughWithRetryAfter() throws Exception {
        upstreamResponse.set(upstream(HttpStatus.TOO_MANY_REQUESTS,
                "{\"detail\":{\"code\":\"TooManyRequests\",\"reason\":\"generated_job_limit\"}}",
                Map.of(HttpHeaders.RETRY_AFTER, "5")));

        performAsync(post(PREFIX + "/animate/generated")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string(HttpHeaders.RETRY_AFTER, "5"))
                .andExpect(jsonPath("$.detail.code").value("TooManyRequests"));
    }

    @Test
    void serviceUnavailableResponseIsPassedThrough() throws Exception {
        upstreamResponse.set(jsonResponse(HttpStatus.SERVICE_UNAVAILABLE,
                "{\"detail\":{\"code\":\"SandboxUnavailable\",\"reason\":\"codegen_disabled\"}}"));

        performAsync(post(PREFIX + "/animate/generated")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.detail.reason").value("codegen_disabled"));
    }

    @Test
    void upstreamUnreachableMapsToGatewayUpstreamError() throws Exception {
        upstreamFailure.set(new WebClientRequestException(
                new ConnectException("Connection refused"),
                HttpMethod.POST,
                URI.create(BASE_URL + "/chat/stream"),
                new HttpHeaders()));

        performAsync(post(PREFIX + "/chat/stream")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"hi\"}"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.status").value(502))
                .andExpect(jsonPath("$.code").value("UPSTREAM_ERROR"));
    }

    @Test
    void requestCannotOverrideTheConfiguredBaseUrl() throws Exception {
        upstreamResponse.set(jsonResponse(HttpStatus.OK, "{}"));

        performAsync(post(PREFIX + "/chat/stream")
                .queryParam("baseUrl", "http://evil.example")
                .queryParam("agent.base-url", "http://evil.example")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isOk());

        URI upstream = captured.get().getURI();
        assertThat(upstream.getHost()).isEqualTo("agent.internal");
        assertThat(upstream.getPort()).isEqualTo(8000);
        assertThat(upstream.getPath()).isEqualTo("/chat/stream");
    }

    @Test
    void routesMissingFromTheFastApiRouterAreNotForwarded() throws Exception {
        MvcResult result = mockMvc.perform(get(PREFIX + "/not-registered"))
                .andReturn();

        assertThat(result.getResponse().getStatus()).isNotEqualTo(HttpStatus.OK.value());
        assertThat(captured.get()).isNull();
    }

    @Test
    void chatProxyAllowsLongerModelGenerationThanGeneralGatewayRequests() {
        assertThat(AgentProxyController.createChatHttpClient().configuration().responseTimeout())
                .isEqualTo(AgentProxyController.CHAT_RESPONSE_TIMEOUT)
                .isGreaterThan(java.time.Duration.ofSeconds(15));
        assertThat(AgentProxyController.CHAT_ASYNC_TIMEOUT)
                .isGreaterThan(AgentProxyController.CHAT_RESPONSE_TIMEOUT);
    }

    @Test
    void knowledgeProxyAllowsRemoteEmbeddingIndexingMoreTimeThanGeneralRequests() {
        assertThat(AgentProxyController.createKnowledgeHttpClient().configuration().responseTimeout())
                .isEqualTo(AgentProxyController.KNOWLEDGE_RESPONSE_TIMEOUT)
                .isGreaterThan(AgentProxyController.CHAT_RESPONSE_TIMEOUT);
        assertThat(AgentProxyController.KNOWLEDGE_ASYNC_TIMEOUT)
                .isGreaterThan(AgentProxyController.KNOWLEDGE_RESPONSE_TIMEOUT);
    }

    private ResultActions performAsync(MockHttpServletRequestBuilder requestBuilder) throws Exception {
        MvcResult asyncResult = mockMvc.perform(requestBuilder)
                .andExpect(request().asyncStarted())
                .andReturn();
        return mockMvc.perform(asyncDispatch(asyncResult));
    }

    private static ClientResponse jsonResponse(HttpStatus status, String body) {
        return upstream(status, body, Map.of());
    }

    private static ClientResponse upstream(HttpStatus status, String body, Map<String, String> headers) {
        ClientResponse.Builder builder = ClientResponse.create(status)
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);
        headers.forEach(builder::header);
        return builder.body(body).build();
    }
}
