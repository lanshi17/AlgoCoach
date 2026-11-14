package com.algocoach.controller;

import com.algocoach.dto.RunRequest;
import com.algocoach.dto.SubmissionResultDto;
import com.algocoach.dto.SubmitRequest;
import com.algocoach.model.SubmissionRecord;
import com.algocoach.service.SubmissionService;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.util.List;

/**
 * POST /api/run          — run the sample (or custom) input through LeetCode interpret_solution
 * POST /api/submit       — formal submission: submit, poll to a terminal state, persist
 * GET  /api/submissions  — newest-first persisted submission history
 *
 * <p>The run and submit endpoints stay reactive; history reads local SQLite synchronously
 * and supports an optional {@code problemId} filter plus an explicit row limit
 * (default {@value #DEFAULT_HISTORY_LIMIT}).</p>
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class SubmissionController {

    static final int DEFAULT_HISTORY_LIMIT = 20;

    private final SubmissionService submissionService;

    @PostMapping("/run")
    public Mono<ResponseEntity<JsonNode>> run(@Valid @RequestBody RunRequest request) {
        return submissionService.run(request).map(ResponseEntity::ok);
    }

    @PostMapping("/submit")
    public Mono<ResponseEntity<SubmissionResultDto>> submit(@Valid @RequestBody SubmitRequest request) {
        return submissionService.submit(request).map(ResponseEntity::ok);
    }

    @GetMapping("/submissions")
    public ResponseEntity<List<SubmissionRecord>> history(
            @RequestParam(required = false) String problemId,
            @RequestParam(defaultValue = "" + DEFAULT_HISTORY_LIMIT) int limit) {
        return ResponseEntity.ok(submissionService.history(problemId, limit));
    }
}
