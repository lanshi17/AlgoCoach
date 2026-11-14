package com.algocoach.model;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins the 24-hour freshness boundary independently of the service wiring.
 */
class ProblemCacheTest {

    private static final long NOW = 1_700_000_000_000L;

    @Test
    void entryInsideTtlIsFresh() {
        ProblemCache cache = cacheWritten(Duration.ofHours(23).toMillis());

        assertThat(cache.isExpired(NOW)).isFalse();
    }

    @Test
    void entryExactlyAtTtlIsStillFresh() {
        ProblemCache cache = cacheWritten(ProblemCache.TTL_MILLIS);

        assertThat(cache.isExpired(NOW)).isFalse();
    }

    @Test
    void entryOlderThanTtlIsExpired() {
        ProblemCache cache = cacheWritten(ProblemCache.TTL_MILLIS + 1);

        assertThat(cache.isExpired(NOW)).isTrue();
    }

    private static ProblemCache cacheWritten(long ageMillis) {
        return new ProblemCache("two-sum", "{}", NOW - ageMillis);
    }
}
