package com.algocoach.service;

import com.algocoach.client.LeetCodeClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ProblemService {

    private static final int PAGE_SIZE = 50;
    private static final Set<String> DIFFICULTIES = Set.of("EASY", "MEDIUM", "HARD");

    private static final String PROBLEM_DETAIL_QUERY = """
        query questionData($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            questionId questionFrontendId title titleSlug
            difficulty content translatedTitle translatedContent
            topicTags { name translatedName slug }
            codeSnippets { lang langSlug code }
            sampleTestCase hints isPaidOnly
          }
        }
        """;

    private static final String DAILY_QUERY = """
        query questionOfToday {
          todayRecord {
            question {
              questionId title titleSlug difficulty
              topicTags { name translatedName slug }
            }
          }
        }
        """;

    // problemsetQuestionListV2 takes a QuestionFilterInput object: an empty
    // filter returns the full catalog, topicFilter.topicSlugs inside one filter
    // is OR-ed, and separate filter objects (topic vs difficulty) are AND-ed.
    // totalLength drives the frontend page count; without it the UI could only
    // guess from hasMore. Note v2 exposes CommonTagNode (`nameTranslated`),
    // unlike QuestionNode's `translatedName`.
    private static final String LIST_QUERY = """
        query problemsetQuestionList($skip: Int, $limit: Int, $categorySlug: String, $filters: QuestionFilterInput) {
          problemsetQuestionList: problemsetQuestionListV2(
            categorySlug: $categorySlug, skip: $skip, limit: $limit, filters: $filters
          ) {
            hasMore
            totalLength
            questions {
              id questionFrontendId title translatedTitle titleSlug
              difficulty topicTags { name nameTranslated slug } paidOnly
            }
          }
        }
        """;

    private final LeetCodeClient client;
    private final ObjectMapper mapper;

    public Mono<JsonNode> fetchBySlug(String slug) {
        return client.graphql(PROBLEM_DETAIL_QUERY, Map.of("titleSlug", slug))
                .map(this::parse)
                .map(n -> n.path("data").path("question"));
    }

    public Mono<JsonNode> fetchDaily() {
        return client.graphql(DAILY_QUERY, Map.of())
                .map(this::parse)
                .map(n -> n.path("data").path("todayRecord").get(0).path("question"));
    }

    public Mono<JsonNode> list(int page, String difficulty, List<String> tags) {
        int skip = Math.max(page - 1, 0) * PAGE_SIZE;
        Map<String, Object> variables = new LinkedHashMap<>();
        variables.put("skip", skip);
        variables.put("limit", PAGE_SIZE);
        variables.put("categorySlug", "");
        variables.put("filters", filters(difficulty, tags));
        return client.graphql(LIST_QUERY, variables)
                .map(this::parse)
                .map(n -> n.path("data").path("problemsetQuestionList"));
    }

    /** Build the v2 QuestionFilterInput from the gateway's query params. */
    private static Map<String, Object> filters(String difficulty, List<String> tags) {
        Map<String, Object> filters = new LinkedHashMap<>();
        filters.put("filterCombineType", "ALL");
        if (difficulty != null && DIFFICULTIES.contains(difficulty.strip().toUpperCase(Locale.ROOT))) {
            filters.put("difficultyFilter", Map.of(
                    "difficulties", List.of(difficulty.strip().toUpperCase(Locale.ROOT))));
        }
        List<String> slugs = tags == null ? List.of() : tags.stream()
                .filter(tag -> tag != null && !tag.isBlank())
                .map(tag -> tag.strip().toLowerCase(Locale.ROOT))
                .distinct()
                .toList();
        if (!slugs.isEmpty()) {
            filters.put("topicFilter", Map.of("topicSlugs", slugs));
        }
        return filters;
    }

    private JsonNode parse(String json) {
        try { return mapper.readTree(json); }
        catch (Exception e) { throw new RuntimeException("Failed to parse LeetCode response", e); }
    }
}
