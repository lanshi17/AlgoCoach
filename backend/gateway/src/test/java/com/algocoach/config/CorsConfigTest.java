package com.algocoach.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies the actual served CORS behaviour (not just the registry configuration):
 * preflight for both Vite origins, path scoping to {@code /api/**}, and rejection
 * of unknown origins.
 */
@WebMvcTest(controllers = CorsConfigTest.TestController.class)
@Import({CorsConfig.class, CorsConfigTest.TestController.class})
@TestPropertySource(properties = "ALGOCOACH_ALLOWED_ORIGINS=http://192.168.1.10:5173")
class CorsConfigTest {

    private static final String CUSTOM_HEADER = "x-algocoach-test";

    @Autowired
    private MockMvc mockMvc;

    @RestController
    static class TestController {

        @GetMapping("/api/ping")
        String apiPing() {
            return "pong";
        }

        @GetMapping("/other/ping")
        String otherPing() {
            return "pong";
        }
    }

    @Test
    void preflightAllowsViteDevOriginOnApiPaths() throws Exception {
        mockMvc.perform(options("/api/ping")
                        .header(HttpHeaders.ORIGIN, CorsConfig.VITE_DEV_ORIGIN)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, CUSTOM_HEADER))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, CorsConfig.VITE_DEV_ORIGIN))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS,
                        allOf(containsString("GET"), containsString("POST"), containsString("PUT"),
                                containsString("DELETE"), containsString("OPTIONS"),
                                not(containsString("PATCH")))))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS, containsString(CUSTOM_HEADER)))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_MAX_AGE, "3600"))
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS));
    }

    @Test
    void preflightAllowsVitePreviewOriginOnApiPaths() throws Exception {
        mockMvc.perform(options("/api/auth/cookie")
                        .header(HttpHeaders.ORIGIN, CorsConfig.VITE_PREVIEW_ORIGIN)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, CorsConfig.VITE_PREVIEW_ORIGIN))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_MAX_AGE, "3600"));
    }

    @Test
    void preflightAllowsLoopbackOrigins() throws Exception {
        mockMvc.perform(options("/api/platforms/ACWING/cookie")
                        .header(HttpHeaders.ORIGIN, CorsConfig.VITE_DEV_LOOPBACK_ORIGIN)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
                        CorsConfig.VITE_DEV_LOOPBACK_ORIGIN));

        mockMvc.perform(options("/api/ping")
                        .header(HttpHeaders.ORIGIN, CorsConfig.VITE_PREVIEW_LOOPBACK_ORIGIN)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
                        CorsConfig.VITE_PREVIEW_LOOPBACK_ORIGIN));
    }

    @Test
    void preflightAllowsConfiguredLanOrigin() throws Exception {
        String origin = "http://192.168.1.10:5173";
        mockMvc.perform(options("/api/ping")
                        .header(HttpHeaders.ORIGIN, origin)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "x-algocoach-sync-token"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, origin))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS,
                        containsString("x-algocoach-sync-token")));
    }

    @Test
    void preflightRejectsUnknownOrigin() throws Exception {
        mockMvc.perform(options("/api/ping")
                        .header(HttpHeaders.ORIGIN, "http://localhost:9999")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @Test
    void nonApiPathIsNotCorsEnabled() throws Exception {
        mockMvc.perform(options("/other/ping")
                        .header(HttpHeaders.ORIGIN, CorsConfig.VITE_DEV_ORIGIN)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @Test
    void actualApiRequestFromAllowedOriginGetsCorsHeader() throws Exception {
        mockMvc.perform(get("/api/ping")
                        .header(HttpHeaders.ORIGIN, CorsConfig.VITE_DEV_ORIGIN))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, CorsConfig.VITE_DEV_ORIGIN));
    }
}
