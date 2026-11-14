package com.algocoach.controller;

import com.algocoach.client.LeetCodeClient;
import com.algocoach.model.UserCookie;
import com.algocoach.repository.UserCookieRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import reactor.core.publisher.Mono;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;

/**
 * MockMvc coverage for the cookie endpoints used by the settings page.
 *
 * <p>The real {@link AuthController} and the uniform {@code GlobalExceptionHandler} are
 * exercised through request dispatch; only the JPA repository is mocked, so no file or
 * database is touched. The tests pin the settings-page contract: the session/csrf pair is
 * stored for the single {@code default} user, {@code /status} reflects its presence, the
 * secret values never appear in any response, and malformed or blank input takes the same
 * {@code VALIDATION_ERROR} envelope as the other gateway endpoints.</p>
 */
@WebMvcTest(controllers = AuthController.class)
class AuthControllerTest {

    private static final String SESSION = "test-session-cookie-value";
    private static final String CSRF = "test-csrf-cookie-value";
    private static final String USER_ID = "default";
    private static final String VALIDATION_MESSAGE = "请求参数校验失败，请检查后重试";

    private static final String COOKIE_BODY = """
            {"session":"test-session-cookie-value","csrf":"test-csrf-cookie-value"}
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserCookieRepository cookieRepo;

    @MockBean
    private LeetCodeClient leetCodeClient;

    @Test
    void saveCookieStoresSessionAndCsrfForTheDefaultUser() throws Exception {
        long before = System.currentTimeMillis();

        mockMvc.perform(post("/api/auth/cookie")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(COOKIE_BODY))
                .andExpect(status().isOk());

        ArgumentCaptor<UserCookie> saved = ArgumentCaptor.forClass(UserCookie.class);
        verify(cookieRepo).save(saved.capture());

        UserCookie cookie = saved.getValue();
        assertThat(cookie.getUserId()).isEqualTo(USER_ID);
        assertThat(cookie.getSession()).isEqualTo(SESSION);
        assertThat(cookie.getCsrf()).isEqualTo(CSRF);
        assertThat(cookie.getUpdatedAt())
                .isNotNull()
                .isBetween(before, System.currentTimeMillis());
    }

    @Test
    void saveCookieReturnsNoBodyAndNeverEchoesTheSecrets() throws Exception {
        mockMvc.perform(post("/api/auth/cookie")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(COOKIE_BODY))
                .andExpect(status().isOk())
                .andExpect(content().string(""))
                .andExpect(content().string(not(containsString(SESSION))))
                .andExpect(content().string(not(containsString(CSRF))));
    }

    @Test
    void statusReportsAuthenticatedWhenTheCookieExists() throws Exception {
        when(cookieRepo.existsById(USER_ID)).thenReturn(true);

        mockMvc.perform(get("/api/auth/status"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.session").doesNotExist())
                .andExpect(jsonPath("$.csrf").doesNotExist())
                .andExpect(content().string(not(containsString(SESSION))))
                .andExpect(content().string(not(containsString(CSRF))));

        verify(cookieRepo).existsById(USER_ID);
    }

    @Test
    void statusReportsUnauthenticatedWhenNoCookieExists() throws Exception {
        when(cookieRepo.existsById(USER_ID)).thenReturn(false);

        mockMvc.perform(get("/api/auth/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(false));

        verify(cookieRepo).existsById(USER_ID);
    }

    @Test
    void validateChecksLeetCodeSignedInStateWithoutReturningCookieValues() throws Exception {
        when(cookieRepo.existsById(USER_ID)).thenReturn(true);
        when(leetCodeClient.graphql(anyString(), anyMap())).thenReturn(Mono.just("""
                {"data":{"userStatus":{"isSignedIn":true}}}
                """));

        MvcResult pending = mockMvc.perform(get("/api/auth/validate"))
                .andExpect(request().asyncStarted())
                .andReturn();
        mockMvc.perform(asyncDispatch(pending))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(content().string(not(containsString(SESSION))))
                .andExpect(content().string(not(containsString(CSRF))));
    }

    @Test
    void validateReportsFalseWhenLeetCodeSessionIsNoLongerSignedIn() throws Exception {
        when(cookieRepo.existsById(USER_ID)).thenReturn(true);
        when(leetCodeClient.graphql(anyString(), anyMap())).thenReturn(Mono.just("""
                {"data":{"userStatus":{"isSignedIn":false}}}
                """));

        MvcResult pending = mockMvc.perform(get("/api/auth/validate"))
                .andExpect(request().asyncStarted())
                .andReturn();
        mockMvc.perform(asyncDispatch(pending))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(false));
    }

    @Test
    void blankSessionIsRejectedWithTheUnifiedValidationError() throws Exception {
        assertValidationError("""
                {"session":"   ","csrf":"test-csrf-cookie-value"}
                """);
    }

    @Test
    void blankCsrfIsRejectedWithTheUnifiedValidationError() throws Exception {
        assertValidationError("""
                {"session":"test-session-cookie-value","csrf":""}
                """);
    }

    @Test
    void missingFieldsAreRejectedWithTheUnifiedValidationError() throws Exception {
        assertValidationError("""
                {"session":"test-session-cookie-value"}
                """);
    }

    @Test
    void malformedJsonIsRejectedWithTheUnifiedValidationError() throws Exception {
        assertValidationError("""
                {"session":"test-session-cookie-value","csrf":
                """);
    }

    @Test
    void emptyBodyIsRejectedWithTheUnifiedValidationError() throws Exception {
        assertValidationError("");
    }

    private void assertValidationError(String body) throws Exception {
        mockMvc.perform(post("/api/auth/cookie")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value(VALIDATION_MESSAGE))
                .andExpect(content().string(not(containsString(SESSION))))
                .andExpect(content().string(not(containsString(CSRF))));

        verify(cookieRepo, never()).save(any(UserCookie.class));
    }
}
