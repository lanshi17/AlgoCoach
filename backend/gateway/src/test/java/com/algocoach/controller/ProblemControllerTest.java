package com.algocoach.controller;

import com.algocoach.client.LeetCodeClient;
import com.algocoach.service.ProblemCacheService;
import com.algocoach.service.ProblemService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import reactor.core.publisher.Mono;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * Pins the cache scope: only {@code GET /api/problems/{slug}} reads through
 * {@link ProblemCacheService}; the list and daily-question endpoints still call
 * {@link ProblemService} directly.
 */
@ExtendWith(MockitoExtension.class)
class ProblemControllerTest {

    private static final String SLUG = "two-sum";

    @Mock
    private LeetCodeClient leetCode;

    @Mock
    private ProblemService problemService;

    @Mock
    private ProblemCacheService problemCacheService;

    private final ObjectMapper mapper = new ObjectMapper();

    private ProblemController controller;

    @BeforeEach
    void setUp() {
        controller = new ProblemController(leetCode, problemService, problemCacheService);
    }

    @Test
    void bySlugReadsThroughCacheAndKeepsResponseShape() {
        JsonNode problem = mapper.createObjectNode().put("title", "Two Sum");
        when(problemCacheService.getBySlug(SLUG)).thenReturn(Mono.just(problem));

        ResponseEntity<JsonNode> response = controller.bySlug(SLUG).block();

        assertThat(response).isNotNull();
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isSameAs(problem);
        verifyNoInteractions(problemService);
    }

    @Test
    void listAndDailyStillCallProblemServiceDirectly() {
        JsonNode list = mapper.createObjectNode().put("total", 1);
        JsonNode daily = mapper.createObjectNode().put("titleSlug", "two-sum");
        when(problemService.list(1, null, null)).thenReturn(Mono.just(list));
        when(problemService.fetchDaily()).thenReturn(Mono.just(daily));

        assertThat(controller.list(1, null, null).block().getBody()).isSameAs(list);
        assertThat(controller.daily().block().getBody()).isSameAs(daily);

        verify(problemService).list(1, null, null);
        verify(problemService).fetchDaily();
        verifyNoInteractions(problemCacheService);
    }
}
