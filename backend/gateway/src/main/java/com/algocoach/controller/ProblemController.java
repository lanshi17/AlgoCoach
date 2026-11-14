package com.algocoach.controller;

import com.algocoach.client.LeetCodeClient;
import com.algocoach.service.ProblemCacheService;
import com.algocoach.service.ProblemService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

/**
 * GET  /api/problems         — list problems (paginated, always upstream)
 * GET  /api/problems/{slug}  — get problem details by titleSlug (24h cache)
 * GET  /api/problems/daily    — get today's daily question (always upstream)
 *
 * All proxied via LeetCodeClient.graphql().
 */
@RestController
@RequestMapping("/api/problems")
@RequiredArgsConstructor
public class ProblemController {

    private final LeetCodeClient leetCode;
    private final ProblemService problemService;
    private final ProblemCacheService problemCacheService;

    @GetMapping
    public Mono<ResponseEntity<JsonNode>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(required = false) String difficulty,
            @RequestParam(required = false) String tag
    ) {
        return problemService.list(page, difficulty, tag)
                .map(ResponseEntity::ok);
    }

    @GetMapping("/{slug}")
    public Mono<ResponseEntity<JsonNode>> bySlug(@PathVariable String slug) {
        return problemCacheService.getBySlug(slug)
                .map(ResponseEntity::ok);
    }

    @GetMapping("/daily")
    public Mono<ResponseEntity<JsonNode>> daily() {
        return problemService.fetchDaily()
                .map(ResponseEntity::ok);
    }
}
