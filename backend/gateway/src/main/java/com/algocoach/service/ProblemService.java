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
        query problemsetQuestionList($skip: Int, $limit: Int, $filters: QuestionListFilterInput) {
          problemsetQuestionList: questionList(
            skip: $skip limit: $limit filters: $filters
          ) {
            total: totalNum
            questions: data {
              questionId frontendQuestionId title titleSlug
              difficulty topicTags { name } isFavor isPaidOnly
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
        Map<String, Object> filters = new java.util.HashMap<>();
        if (difficulty != null && !difficulty.isBlank()) filters.put("difficulty", difficulty);
        if (tag != null && !tag.isBlank()) filters.put("tags", new String[]{ tag });
        return client.graphql(LIST_QUERY, Map.of("skip", skip, "limit", 50, "filters", filters))
                .map(this::parse)
                .map(n -> n.path("data").path("problemsetQuestionList"));
    }

    private JsonNode parse(String json) {
        try { return mapper.readTree(json); }
        catch (Exception e) { throw new RuntimeException("Failed to parse LeetCode response", e); }
    }
}
