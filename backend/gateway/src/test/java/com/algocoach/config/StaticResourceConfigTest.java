package com.algocoach.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies the real {@code /animations/**} resource handler end to end: the configured
 * directory is the only source, MP4s get the right MIME type, missing files are 404,
 * {@code ../} cannot escape the root, and HTTP Range requests work for video seeking.
 */
@WebMvcTest(controllers = StaticResourceConfigTest.PlaceholderController.class)
@Import(StaticResourceConfig.class)
class StaticResourceConfigTest {

    /** Minimal ISO-BMFF sample: a complete {@code ftyp} box followed by an empty {@code mdat} box. */
    private static final byte[] MP4_BYTES = {
            0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
            0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x02, 0x00,
            0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
            0x00, 0x00, 0x00, 0x08, 0x6D, 0x64, 0x61, 0x74
    };

    private static final String OUTSIDE_CONTENT = "must-not-be-served";

    @TempDir
    static Path tempDir;

    @DynamicPropertySource
    static void animationLocation(DynamicPropertyRegistry registry) {
        registry.add(StaticResourceConfig.LOCATION_PROPERTY,
                () -> expectedFileUrl(servedRoot()));
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StaticResourceConfig config;

    private static Path servedRoot() {
        return tempDir.resolve("data").resolve("animations");
    }

    private static String expectedFileUrl(Path path) {
        String uri = path.toUri().toString();
        return uri.endsWith("/") ? uri : uri + "/";
    }

    @BeforeEach
    void setUp() throws IOException {
        Files.createDirectories(servedRoot());
        Files.write(servedRoot().resolve("job-1.mp4"), MP4_BYTES);
        Files.write(tempDir.resolve("data").resolve("outside.mp4"),
                OUTSIDE_CONTENT.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void configuredLocationIsResolvedAndUsed() {
        assertThat(config.getResourceLocation()).isEqualTo(expectedFileUrl(servedRoot()));
    }

    @Test
    void servesMp4FromConfiguredDirectoryAsVideoMp4() throws Exception {
        mockMvc.perform(get("/animations/job-1.mp4"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "video/mp4"))
                .andExpect(header().string(HttpHeaders.CONTENT_LENGTH,
                        String.valueOf(MP4_BYTES.length)))
                .andExpect(content().bytes(MP4_BYTES));
    }

    @Test
    void missingFileReturnsNotFound() throws Exception {
        mockMvc.perform(get("/animations/does-not-exist.mp4"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void dotDotTraversalCannotReadFileOutsideConfiguredDirectory() throws Exception {
        mockMvc.perform(get("/animations/../outside.mp4"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/animations/%2e%2e/outside.mp4"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/animations/..%2Foutside.mp4"))
                .andExpect(status().isNotFound());
    }

    @Test
    void rangeRequestReturnsPartialContent() throws Exception {
        mockMvc.perform(get("/animations/job-1.mp4")
                        .header(HttpHeaders.RANGE, "bytes=0-3"))
                .andExpect(status().isPartialContent())
                .andExpect(header().string(HttpHeaders.ACCEPT_RANGES, "bytes"))
                .andExpect(header().string(HttpHeaders.CONTENT_RANGE,
                        "bytes 0-3/" + MP4_BYTES.length))
                .andExpect(content().bytes(Arrays.copyOfRange(MP4_BYTES, 0, 4)));
    }

    @Test
    void normalizeAddsTrailingSlashAndResolvesRelativeAgainstWorkingDirectory() {
        Path workingDirectory = tempDir.resolve("backend").resolve("gateway");
        String normalized = StaticResourceConfig.normalizeLocation(
                StaticResourceConfig.DEFAULT_LOCATION, workingDirectory);

        assertThat(normalized).isEqualTo(expectedFileUrl(tempDir.resolve("data").resolve("animations")));
    }

    @Test
    void normalizeCollapsesDotDotInAbsoluteLocations() {
        Path absolute = tempDir.resolve("data").resolve("other").resolve("..").resolve("animations");
        String normalized = StaticResourceConfig.normalizeLocation("file:" + absolute);

        assertThat(normalized).isEqualTo(expectedFileUrl(tempDir.resolve("data").resolve("animations")));
    }

    @Test
    void normalizeRejectsBlankAndNonFileLocations() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> StaticResourceConfig.normalizeLocation("  "));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> StaticResourceConfig.normalizeLocation("file:"));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> StaticResourceConfig.normalizeLocation("classpath:/static/"));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> StaticResourceConfig.normalizeLocation("https://example.com/animations/"));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> StaticResourceConfig.normalizeLocation("file://example.com/animations/"));
    }

    @RestController
    static class PlaceholderController {

        @GetMapping("/api/placeholder")
        String placeholder() {
            return "ok";
        }
    }
}
