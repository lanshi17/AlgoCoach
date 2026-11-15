package com.algocoach.service;

import com.algocoach.client.LeetCodeClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Pins the LeetCode v2 filter encoding: the variable type must be
 * {@code QuestionFilterInput} (not the similarly named
 * {@code QuestionListFilterInputV2}), topic slugs stay a list inside
 * {@code topicFilter.topicSlugs}, and difficulty only accepts the three
 * upstream enum values.
 */
@ExtendWith(MockitoExtension.class)
class ProblemServiceTest {

    @Mock
    private LeetCodeClient client;

    private final ObjectMapper mapper = new ObjectMapper();
    private ProblemService service;

    @BeforeEach
    void setUp() {
        service = new ProblemService(client, mapper);
    }

    @Test
    @SuppressWarnings("unchecked")
    void listBuildsTopicAndDifficultyFilters() {
        when(client.graphql(anyString(), anyMap()))
                .thenReturn(Mono.just("{\"data\":{\"problemsetQuestionList\":{\"hasMore\":false}}}"));

        JsonNode result = service.list(2, "hard", List.of("dynamic-programming", "memoization", "  ")).block();
        assertThat(result).isNotNull();

        ArgumentCaptor<String> query = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Map<String, Object>> variables = ArgumentCaptor.forClass(Map.class);
        verify(client).graphql(query.capture(), variables.capture());

        assertThat(query.getValue()).contains("$filters: QuestionFilterInput");
        assertThat(variables.getValue())
                .containsEntry("skip", 50)
                .containsEntry("limit", 50)
                .containsEntry("categorySlug", "");
        Map<String, Object> filters = (Map<String, Object>) variables.getValue().get("filters");
        assertThat(filters).containsEntry("filterCombineType", "ALL");
        assertThat(filters.get("difficultyFilter"))
                .isEqualTo(Map.of("difficulties", List.of("HARD")));
        assertThat(filters.get("topicFilter"))
                .isEqualTo(Map.of("topicSlugs", List.of("dynamic-programming", "memoization")));
    }

    @Test
    @SuppressWarnings("unchecked")
    void listSendsOnlyCombineTypeWithoutFilters() {
        when(client.graphql(anyString(), anyMap()))
                .thenReturn(Mono.just("{\"data\":{\"problemsetQuestionList\":{\"hasMore\":true}}}"));

        service.list(1, "", null).block();

        ArgumentCaptor<Map<String, Object>> variables = ArgumentCaptor.forClass(Map.class);
        verify(client).graphql(anyString(), variables.capture());
        Map<String, Object> filters = (Map<String, Object>) variables.getValue().get("filters");
        assertThat(filters).containsEntry("filterCombineType", "ALL");
        assertThat(filters).doesNotContainKeys("difficultyFilter", "topicFilter");
    }
}
