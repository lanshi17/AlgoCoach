package com.algocoach.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;
import java.util.stream.Stream;

/**
 * CORS policy for the React frontend.
 *
 * <p>Only {@code /api/**} is exposed, and only the two Vite origins used during
 * development ({@code 5173}) and preview ({@code 4173}) are allowed. Cookies are
 * not exchanged cross-origin, so {@code allowCredentials} stays {@code false}.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    /** Paths the browser is allowed to call cross-origin. */
    public static final String API_MAPPING = "/api/**";

    /** Vite dev server. */
    public static final String VITE_DEV_ORIGIN = "http://localhost:5173";

    /** Vite preview server. */
    public static final String VITE_PREVIEW_ORIGIN = "http://localhost:4173";

    /** Loopback spelled as an IP: same dev server, different browser origin. */
    public static final String VITE_DEV_LOOPBACK_ORIGIN = "http://127.0.0.1:5173";

    /** Loopback preview origin. */
    public static final String VITE_PREVIEW_LOOPBACK_ORIGIN = "http://127.0.0.1:4173";

    /** Preflight cache lifetime in seconds. */
    public static final long MAX_AGE_SECONDS = 3600L;

    private final String[] extraOrigins;

    public CorsConfig(@Value("${ALGOCOACH_ALLOWED_ORIGINS:}") String extraOrigins) {
        this.extraOrigins = Arrays.stream(extraOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toArray(String[]::new);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String[] origins = Stream.concat(
                        Stream.of(VITE_DEV_ORIGIN, VITE_PREVIEW_ORIGIN,
                                VITE_DEV_LOOPBACK_ORIGIN, VITE_PREVIEW_LOOPBACK_ORIGIN),
                        Arrays.stream(extraOrigins))
                .distinct()
                .toArray(String[]::new);
        registry.addMapping(API_MAPPING)
                .allowedOrigins(origins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(false)
                .maxAge(MAX_AGE_SECONDS);
    }
}
