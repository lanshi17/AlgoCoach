package com.algocoach.service;

import com.algocoach.dto.MemoryRecordRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;

/** Best-effort callback for propagating completed LeetCode submissions into agent memory. */
@Slf4j
@Component
public class AgentMemoryClient {

    static final Duration CALLBACK_TIMEOUT = Duration.ofSeconds(2);

    private final WebClient client;

    public AgentMemoryClient(
            WebClient.Builder webClientBuilder,
            @Value("${agent.base-url}") String agentBaseUrl) {
        this.client = webClientBuilder.clone().baseUrl(normalizeBaseUrl(agentBaseUrl)).build();
    }

    public Mono<Void> record(MemoryRecordRequest request) {
        return client.post()
                .uri("/memory/record")
                .bodyValue(request)
                .retrieve()
                .toBodilessEntity()
                .timeout(CALLBACK_TIMEOUT)
                .then();
    }

    private static String normalizeBaseUrl(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("agent.base-url must be configured");
        }
        String normalized = value.trim();
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }
}
