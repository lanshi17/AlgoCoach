package com.algocoach.config;

import io.netty.channel.ChannelOption;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;

/**
 * Shared {@link WebClient.Builder} used by {@code LeetCodeClient}.
 *
 * <p>Defining the builder here replaces Spring Boot's auto-configured
 * {@code WebClient.Builder} (that bean is {@code @ConditionalOnMissingBean}), so
 * there is exactly one builder in the context and no duplicate-bean conflict.
 * The timeouts match §10 of {@code docs/backend-gateway.md}: 5 s to connect and
 * 15 s for the response.
 */
@Configuration
public class WebClientConfig {

    /** TCP connect timeout in milliseconds. */
    public static final int CONNECT_TIMEOUT_MILLIS = 5_000;

    /** Time allowed for the server to produce a response. */
    public static final Duration RESPONSE_TIMEOUT = Duration.ofSeconds(15);

    @Bean
    public WebClient.Builder webClientBuilder() {
        return WebClient.builder()
                .clientConnector(new ReactorClientHttpConnector(createHttpClient()));
    }

    /**
     * Builds the Reactor Netty client with the gateway timeouts.
     * Package-private so {@code WebClientConfigTest} can assert the configured
     * values without reflection.
     */
    static HttpClient createHttpClient() {
        return HttpClient.create()
                .responseTimeout(RESPONSE_TIMEOUT)
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, CONNECT_TIMEOUT_MILLIS);
    }
}
