package com.algocoach.service;

import com.algocoach.model.ProblemCache;
import com.algocoach.repository.ProblemCacheRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.time.Duration;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Covers the three behaviours the cache exists for: a fresh hit makes no upstream
 * request, a miss fetches upstream and writes the JSON back, and an entry older than
 * 24 hours is refreshed and overwritten.
 */
@ExtendWith(MockitoExtension.class)
class ProblemCacheServiceTest {

    private static final String SLUG = "two-sum";

    @Mock
    private ProblemCacheRepository repository;

    @Mock
    private ProblemService problemService;

    private final ObjectMapper mapper = new ObjectMapper();

    private ProblemCacheService service;

    @BeforeEach
    void setUp() {
        service = new ProblemCacheService(repository, problemService, mapper);
    }

    @Test
    void freshHitReturnsStoredJsonWithoutCallingUpstream() {
        when(repository.findById(SLUG)).thenReturn(Optional.of(
                cacheWrittenAgo(Duration.ofHours(23))));

        StepVerifier.create(service.getBySlug(SLUG))
                .assertNext(problem -> {
                    assertThat(problem.path("title").asText()).isEqualTo("Two Sum");
                    assertThat(problem.path("difficulty").asText()).isEqualTo("Easy");
                })
                .verifyComplete();

        verifyNoInteractions(problemService);
        verify(repository, never()).save(any());
    }

    @Test
    void missFetchesUpstreamAndStoresReturnedJson() {
        when(repository.findById(SLUG)).thenReturn(Optional.empty());
        JsonNode upstream = mapper.createObjectNode()
                .put("title", "Two Sum")
                .put("difficulty", "Easy");
        when(problemService.fetchBySlug(SLUG)).thenReturn(Mono.just(upstream));

        StepVerifier.create(service.getBySlug(SLUG))
                .assertNext(problem -> assertThat(problem).isEqualTo(upstream))
                .verifyComplete();

        ArgumentCaptor<ProblemCache> saved = ArgumentCaptor.forClass(ProblemCache.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().getTitleSlug()).isEqualTo(SLUG);
        assertThat(saved.getValue().getContentJson()).isEqualTo(upstream.toString());
        assertThat(saved.getValue().getCachedAt()).isLessThanOrEqualTo(System.currentTimeMillis());
        verify(problemService).fetchBySlug(SLUG);
    }

    @Test
    void expiredEntryRefreshesFromUpstreamAndOverwritesCache() {
        when(repository.findById(SLUG)).thenReturn(Optional.of(
                cacheWrittenAgo(Duration.ofHours(25))));
        JsonNode fresh = mapper.createObjectNode().put("title", "Two Sum (refreshed)");
        when(problemService.fetchBySlug(SLUG)).thenReturn(Mono.just(fresh));

        StepVerifier.create(service.getBySlug(SLUG))
                .assertNext(problem -> assertThat(problem.path("title").asText())
                        .isEqualTo("Two Sum (refreshed)"))
                .verifyComplete();

        ArgumentCaptor<ProblemCache> saved = ArgumentCaptor.forClass(ProblemCache.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().getContentJson()).isEqualTo(fresh.toString());
        verify(problemService).fetchBySlug(SLUG);
    }

    private static ProblemCache cacheWrittenAgo(Duration age) {
        return new ProblemCache(SLUG,
                "{\"title\":\"Two Sum\",\"difficulty\":\"Easy\"}",
                System.currentTimeMillis() - age.toMillis());
    }
}
