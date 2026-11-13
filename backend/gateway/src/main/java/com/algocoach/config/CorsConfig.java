package com.algocoach.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

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

    /** Preflight cache lifetime in seconds. */
    public static final long MAX_AGE_SECONDS = 3600L;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping(API_MAPPING)
                .allowedOrigins(VITE_DEV_ORIGIN, VITE_PREVIEW_ORIGIN)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(false)
                .maxAge(MAX_AGE_SECONDS);
    }
}
