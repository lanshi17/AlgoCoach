package com.algocoach.controller;

import com.algocoach.service.HduService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

/**
 * HDU problemset: {@code GET /api/hdu/problems?volume} and
 * {@code GET /api/hdu/problems/{id}} (a volume holds 100 problems).
 */
@RestController
@RequestMapping("/api/hdu/problems")
@RequiredArgsConstructor
public class HduController {

    private final HduService hduService;

    @GetMapping
    public Mono<ResponseEntity<JsonNode>> list(@RequestParam(defaultValue = "1") int volume) {
        return hduService.list(volume).map(ResponseEntity::ok);
    }

    @GetMapping("/{problemId}")
    public Mono<ResponseEntity<JsonNode>> detail(@PathVariable String problemId) {
        return hduService.detail(problemId).map(ResponseEntity::ok);
    }
}
