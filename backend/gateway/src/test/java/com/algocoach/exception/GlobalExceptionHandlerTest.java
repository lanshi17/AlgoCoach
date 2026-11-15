package com.algocoach.exception;

import com.algocoach.client.LeetCodeClient;
import com.algocoach.controller.AuthController;
import com.algocoach.controller.ProblemController;
import com.algocoach.repository.UserCookieRepository;
import com.algocoach.service.ProblemCacheService;
import com.algocoach.service.ProblemService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.async.AsyncRequestTimeoutException;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeoutException;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end MVC tests for the uniform {@code {status, code, message}} error envelope.
 *
 * <p>The real {@link ProblemController} and {@link AuthController} are exercised with
 * mocked dependencies that emit the same exceptions the gateway produces at runtime,
 * so the advice is verified through actual request dispatch rather than by calling
 * handler methods directly. Problem endpoints are reactive, therefore their errors
 * are asserted after {@code asyncDispatch}.</p>
 */
@WebMvcTest(controllers = {ProblemController.class, AuthController.class})
@Import(GlobalExceptionHandlerTest.SubmissionTimeoutProbeController.class)
class GlobalExceptionHandlerTest {

    private static final String SLUG = "two-sum";
    private static final String UPSTREAM_SECRET = "upstream-secret-body";
    private static final String INTERNAL_SECRET = "internal detail LEETCODE_SESSION=leaked-cookie-value";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private LeetCodeClient leetCode;

    @MockBean
    private ProblemService problemService;

    @MockBean
    private ProblemCacheService problemCacheService;

    @MockBean
    private UserCookieRepository userCookieRepository;

    @Test
    void missingCookieReturns401CookieMissing() throws Exception {
        when(problemCacheService.getBySlug(SLUG))
                .thenReturn(Mono.error(new CookieMissingException()));

        performAsync(get("/api/problems/{slug}", SLUG))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value(GlobalExceptionHandler.COOKIE_MISSING_CODE))
                .andExpect(jsonPath("$.message").value(GlobalExceptionHandler.COOKIE_MISSING_MESSAGE))
                .andExpect(content().string(not(containsString("cookie is not configured"))));
    }

    @Test
    void upstream401Returns401CookieExpiredWithoutLeakingBody() throws Exception {
        when(problemCacheService.getBySlug(SLUG))
                .thenReturn(Mono.error(upstreamResponse(401)));

        performAsync(get("/api/problems/{slug}", SLUG))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value(GlobalExceptionHandler.COOKIE_EXPIRED_CODE))
                .andExpect(jsonPath("$.message").value(GlobalExceptionHandler.COOKIE_EXPIRED_MESSAGE))
                .andExpect(content().string(not(containsString(UPSTREAM_SECRET))));
    }

    @Test
    void upstream429Returns429RateLimited() throws Exception {
        when(problemService.list(1, null, null))
                .thenReturn(Mono.error(upstreamResponse(429)));

        performAsync(get("/api/problems"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.code").value(GlobalExceptionHandler.RATE_LIMITED_CODE))
                .andExpect(jsonPath("$.message").value(GlobalExceptionHandler.RATE_LIMITED_MESSAGE))
                .andExpect(content().string(not(containsString(UPSTREAM_SECRET))));
    }

    @Test
    void otherUpstreamStatusReturns502UpstreamErrorWithoutLeakingBody() throws Exception {
        when(problemService.fetchDaily())
                .thenReturn(Mono.error(upstreamResponse(500)));

        performAsync(get("/api/problems/daily"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.status").value(502))
                .andExpect(jsonPath("$.code").value(GlobalExceptionHandler.UPSTREAM_ERROR_CODE))
                .andExpect(jsonPath("$.message").value(GlobalExceptionHandler.UPSTREAM_ERROR_MESSAGE))
                .andExpect(content().string(not(containsString(UPSTREAM_SECRET))));
    }

    @Test
    void upstreamTimeoutReturns504UpstreamTimeout() throws Exception {
        when(problemService.fetchDaily())
                .thenReturn(Mono.error(upstreamTimeout()));

        performAsync(get("/api/problems/daily"))
                .andExpect(status().isGatewayTimeout())
                .andExpect(jsonPath("$.status").value(504))
                .andExpect(jsonPath("$.code").value(GlobalExceptionHandler.UPSTREAM_TIMEOUT_CODE))
                .andExpect(jsonPath("$.message").value(GlobalExceptionHandler.UPSTREAM_TIMEOUT_MESSAGE));
    }

    @Test
    void servletAsyncTimeoutReturns504InsteadOfInternalServerError() throws Exception {
        performAsync(get("/api/probe/async-timeout"))
                .andExpect(status().isGatewayTimeout())
                .andExpect(jsonPath("$.status").value(504))
                .andExpect(jsonPath("$.code").value(GlobalExceptionHandler.UPSTREAM_TIMEOUT_CODE));
    }

    @Test
    void validationFailureReturns400ValidationError() throws Exception {
        mockMvc.perform(post("/api/auth/cookie")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"session\":\"\",\"csrf\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value(GlobalExceptionHandler.VALIDATION_ERROR_CODE))
                .andExpect(jsonPath("$.message").value(GlobalExceptionHandler.VALIDATION_ERROR_MESSAGE));
    }

    @Test
    void malformedJsonReturns400ValidationError() throws Exception {
        mockMvc.perform(post("/api/auth/cookie")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not-json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(GlobalExceptionHandler.VALIDATION_ERROR_CODE));
    }

    @Test
    void submissionTimeoutReturns503SubmissionTimeout() throws Exception {
        performAsync(get("/api/probe/submission-timeout"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value(503))
                .andExpect(jsonPath("$.code").value(GlobalExceptionHandler.SUBMISSION_TIMEOUT_CODE))
                .andExpect(jsonPath("$.message").value(GlobalExceptionHandler.SUBMISSION_TIMEOUT_MESSAGE))
                .andExpect(content().string(not(containsString("polling"))));
    }

    @Test
    void unexpectedIllegalStateReturns500InternalErrorWithoutLeakingDetails() throws Exception {
        // A generic IllegalStateException must NOT be mistaken for a missing cookie.
        when(problemService.fetchDaily())
                .thenReturn(Mono.error(new IllegalStateException(INTERNAL_SECRET)));

        performAsync(get("/api/problems/daily"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.code").value(GlobalExceptionHandler.INTERNAL_ERROR_CODE))
                .andExpect(jsonPath("$.message").value(GlobalExceptionHandler.INTERNAL_ERROR_MESSAGE))
                .andExpect(content().string(not(containsString("internal detail"))))
                .andExpect(content().string(not(containsString("leaked-cookie-value"))));
    }

    private ResultActions performAsync(MockHttpServletRequestBuilder requestBuilder) throws Exception {
        MvcResult asyncResult = mockMvc.perform(requestBuilder)
                .andExpect(request().asyncStarted())
                .andReturn();
        return mockMvc.perform(asyncDispatch(asyncResult));
    }

    private static WebClientResponseException upstreamResponse(int status) {
        return WebClientResponseException.create(
                status,
                "Upstream Error",
                HttpHeaders.EMPTY,
                UPSTREAM_SECRET.getBytes(StandardCharsets.UTF_8),
                StandardCharsets.UTF_8);
    }

    private static WebClientRequestException upstreamTimeout() {
        return new WebClientRequestException(
                new TimeoutException("Read timed out after 15s"),
                HttpMethod.POST,
                URI.create("https://leetcode.cn/graphql"),
                HttpHeaders.EMPTY);
    }

    /**
     * Minimal endpoint used only to drive {@link SubmissionTimeoutException} through a
     * real MVC dispatch; the production {@code SubmissionController} is out of scope.
     */
    @RestController
    static class SubmissionTimeoutProbeController {

        @GetMapping("/api/probe/submission-timeout")
        Mono<Void> fail() {
            return Mono.error(new SubmissionTimeoutException());
        }

        @GetMapping("/api/probe/async-timeout")
        Mono<Void> asyncTimeout() {
            return Mono.error(new AsyncRequestTimeoutException());
        }
    }
}
