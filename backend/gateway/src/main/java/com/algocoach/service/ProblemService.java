package com.algocoach.service;

import com.algocoach.client.LeetCodeClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class ProblemService {

    private static final String PROBLEM_DETAIL_QUERY = """
        query questionData($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            questionId questionFrontendId title titleSlug
            difficulty content translatedTitle translatedContent
            topicTags { name nameTranslated slug }
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
              topicTags { name nameTranslated slug }
            }
          }
        }
        """;

    private static final String LIST_QUERY = """
        query problemsetQuestionList($skip: Int, $limit: Int, $categorySlug: String) {
          problemsetQuestionList: problemsetQuestionListV2(
            categorySlug: $categorySlug, skip: $skip, limit: $limit,
            filters: { filterCombineType: ALL }
          ) {
            hasMore
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

    public Mono<JsonNode> list(int page, String difficulty, String tag) {
        int skip = (page - 1) * 50;
        // LeetCode removed the legacy questionList field. The v2 endpoint
        // currently accepts only its required combine type in this deployment;
        // difficulty/tag remain reserved for a future v2 filter mapping.
        return client.graphql(LIST_QUERY, Map.of("skip", skip, "limit", 50, "categorySlug", ""))
                .map(this::parse)
                .map(n -> n.path("data").path("problemsetQuestionList"));
    }

    private JsonNode parse(String json) {
        try { return mapper.readTree(json); }
        catch (Exception e) { throw new RuntimeException("Failed to parse LeetCode response", e); }
    }
}
