package com.algocoach.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Duration;

/**
 * Cached LeetCode problem detail, keyed by {@code titleSlug}.
 *
 * <p>{@code contentJson} stores the complete problem JSON returned by the gateway
 * (the {@code data.question} node as produced by {@link com.algocoach.service.ProblemService}),
 * so a cache hit can reproduce the exact response body without asking LeetCode again.
 * Entries older than {@link #TTL} are considered stale and must be refreshed.</p>
 */
@Entity
@Table(name = "problem_cache", indexes = {
        @Index(name = "idx_problem_cache_cached_at", columnList = "cached_at")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ProblemCache {

    /** How long a cached problem stays fresh. */
    public static final Duration TTL = Duration.ofHours(24);

    /** {@link #TTL} in milliseconds. */
    public static final long TTL_MILLIS = TTL.toMillis();

    @Id
    private String titleSlug;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String contentJson;

    /** Unix timestamp in milliseconds when this entry was written. */
    @Column(name = "cached_at", nullable = false)
    private Long cachedAt;

    @Transient
    public boolean isExpired() {
        return isExpired(System.currentTimeMillis());
    }

    @Transient
    boolean isExpired(long nowMillis) {
        return nowMillis - cachedAt > TTL_MILLIS;
    }
}
