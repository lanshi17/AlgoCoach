package com.algocoach.config;

import java.nio.file.InvalidPathException;
import java.nio.file.Path;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Read-only static resource mapping for the Remotion-rendered MP4 files.
 *
 * <p>The Python agent writes videos to its {@code OUTPUT_DIR} and returns
 * {@code /animations/{jobId}.mp4} as the public video URL. This handler serves
 * exactly that URL shape from a single configured directory:
 *
 * <ul>
 *   <li>local runs from {@code backend/gateway} use the default
 *       {@code file:../../data/animations/} (the repository's {@code data/animations});</li>
 *   <li>the container sets {@code ANIMATIONS_LOCATION=file:/data/animations/} to read the
 *       shared {@code ./data:/data} mount.</li>
 * </ul>
 *
 * <p>The location is resolved once at startup. Relative {@code file:} paths are resolved
 * against the process working directory, {@code ..} segments are normalized away and the
 * trailing slash required by Spring's resource resolution is added. Only files below that
 * directory can be served: request paths never select a filesystem location, and Spring's
 * {@code PathResourceResolver} rejects {@code ..} traversal outside the configured root.
 * The handler is read-only (GET/HEAD) and also supports HTTP Range requests, which browsers
 * use for video seeking.
 */
@Configuration
public class StaticResourceConfig implements WebMvcConfigurer {

    /** Public URL prefix used by the agent and the frontend. */
    public static final String ANIMATIONS_MAPPING = "/animations/**";

    /** Default location: repository-root {@code data/animations} when run from {@code backend/gateway}. */
    public static final String DEFAULT_LOCATION = "file:../../data/animations/";

    /** Configuration property holding the single served directory. */
    public static final String LOCATION_PROPERTY = "animations.location";

    private static final String FILE_PREFIX = "file:";

    private static final Logger log = LoggerFactory.getLogger(StaticResourceConfig.class);

    private final String resourceLocation;

    public StaticResourceConfig(
            @Value("${animations.location:" + DEFAULT_LOCATION + "}") String location) {
        this.resourceLocation = normalizeLocation(location);
        log.info("Serving Remotion animations from {}", this.resourceLocation);
    }

    /** The normalized {@code file:} location used by the resource handler. */
    public String getResourceLocation() {
        return resourceLocation;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler(ANIMATIONS_MAPPING)
                .addResourceLocations(resourceLocation);
    }

    /**
     * Normalizes a configured location against the process working directory.
     *
     * <p>Only {@code file:} locations are accepted so the gateway cannot accidentally expose a
     * classpath or remote resource; blank values and other schemes fail fast at startup.
     */
    static String normalizeLocation(String location) {
        return normalizeLocation(location, Path.of(System.getProperty("user.dir")));
    }

    static String normalizeLocation(String location, Path workingDirectory) {
        String value = location == null ? "" : location.trim();
        if (value.isEmpty()) {
            throw new IllegalArgumentException(LOCATION_PROPERTY + " must not be blank");
        }
        if (!value.regionMatches(true, 0, FILE_PREFIX, 0, FILE_PREFIX.length())) {
            throw new IllegalArgumentException(
                    LOCATION_PROPERTY + " must be a file: location, but was: " + value);
        }

        String path = value.substring(FILE_PREFIX.length());
        if (path.isBlank()) {
            throw new IllegalArgumentException(
                    LOCATION_PROPERTY + " must point at a directory, but was: " + value);
        }
        if (path.startsWith("//")) {
            // file:///data/animations -> /data/animations; a remote host is not supported.
            path = path.substring(2);
            if (!path.startsWith("/")) {
                throw new IllegalArgumentException(
                        LOCATION_PROPERTY + " must not reference a remote file: host: " + value);
            }
        }

        Path resolved;
        try {
            Path candidate = Path.of(path);
            resolved = (candidate.isAbsolute()
                    ? candidate
                    : workingDirectory.resolve(candidate)).normalize();
        } catch (InvalidPathException ex) {
            throw new IllegalArgumentException(
                    LOCATION_PROPERTY + " is not a valid path: " + value, ex);
        }

        String uri = resolved.toUri().toString();
        return uri.endsWith("/") ? uri : uri + "/";
    }
}
