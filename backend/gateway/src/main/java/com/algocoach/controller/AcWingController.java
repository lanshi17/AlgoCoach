package com.algocoach.controller;

import com.algocoach.service.AcWingService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

/**
 * AcWing problemset: {@code GET /api/acwing/problems?page&tag} and
 * {@code GET /api/acwing/problems/{id}}.
 *
 * <p>{@code tag} is an AcWing algorithm tag (e.g. {@code 模拟}, {@code 二分});
 * the gateway routes it to the site's tag search.</p>
 */
@RestController
@RequestMapping("/api/acwing/problems")
@RequiredArgsConstructor
public class AcWingController {

    private final AcWingService acWingService;

    @GetMapping
    public Mono<ResponseEntity<JsonNode>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(required = false) String tag
    ) {
        return acWingService.list(page, tag).map(ResponseEntity::ok);
    }

    @GetMapping("/{problemId}")
    public Mono<ResponseEntity<JsonNode>> detail(@PathVariable String problemId) {
        return acWingService.detail(problemId).map(ResponseEntity::ok);
    }
}
