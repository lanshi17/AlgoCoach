package com.algocoach.service;

import com.algocoach.model.ProblemCache;
import com.algocoach.repository.ProblemCacheRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

/**
 * Read-through cache for a single problem's detail JSON.
 *
 * <p>Cache hit (and not expired) returns the stored JSON without touching LeetCode.
 * A miss or an expired entry refreshes through {@link ProblemService#fetchBySlug(String)}
 * and writes the fresh JSON back. SQLite access is blocking, so every repository call
 * runs on {@link Schedulers#boundedElastic()} instead of the Netty event loop.</p>
 */
@Service
@RequiredArgsConstructor
public class ProblemCacheService {

    private final ProblemCacheRepository repository;
    private final ProblemService problemService;
    private final ObjectMapper mapper;

    public Mono<JsonNode> getBySlug(String slug) {
        return Mono.fromCallable(() -> repository.findById(slug))
                .subscribeOn(Schedulers.boundedElastic())
                .flatMap(found -> found
                        .filter(cache -> !cache.isExpired())
                        .map(this::fromCache)
                        .orElseGet(() -> refresh(slug)));
    }

    private Mono<JsonNode> fromCache(ProblemCache cache) {
        return Mono.fromCallable(() -> mapper.readTree(cache.getContentJson()))
                .subscribeOn(Schedulers.boundedElastic())
                // A corrupt row must not fail the request: treat it as a miss and refresh.
                .onErrorResume(e -> refresh(cache.getTitleSlug()));
    }

    private Mono<JsonNode> refresh(String slug) {
        return problemService.fetchBySlug(slug)
                .flatMap(problem -> store(slug, problem).thenReturn(problem));
    }

    private Mono<Void> store(String slug, JsonNode problem) {
        return Mono.fromCallable(() -> repository.save(
                        new ProblemCache(slug, problem.toString(), System.currentTimeMillis())))
                .subscribeOn(Schedulers.boundedElastic())
                .then();
    }
}
