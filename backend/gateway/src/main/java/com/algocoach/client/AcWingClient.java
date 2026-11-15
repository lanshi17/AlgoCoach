package com.algocoach.client;

import com.algocoach.exception.PlatformCookieMissingException;
import com.algocoach.model.PlatformCookie;
import com.algocoach.repository.PlatformCookieRepository;
import com.algocoach.util.CookieHeader;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;

/**
 * WebClient for AcWing pages. AcWing answers anonymous requests with a 302 to
 * {@code /403/} or {@code /login}, so every call carries the cookie stored in
 * the settings page.
 */
@Component
@RequiredArgsConstructor
public class AcWingClient {

    // The AcWing list/search pages are ~340 KB, above Spring's default 256 KB
    // codec cap; without this the body decode fails with a 500.
    static final int MAX_BODY_BYTES = 8 * 1024 * 1024;
    static final Duration FETCH_TIMEOUT = Duration.ofSeconds(30);
    static final String USER_AGENT =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                    + "(KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36";

    @Value("${acwing.base-url}")
    private String baseUrl;

    private final PlatformCookieRepository cookieRepo;
    private final WebClient.Builder webClientBuilder;

    public Mono<String> get(String path) {
        String cookie = cookieRepo.findById("ACWING")
                .map(PlatformCookie::getCookie)
                .map(CookieHeader::normalize)
                .orElse(null);
        if (cookie == null) {
            throw new PlatformCookieMissingException("ACWING");
        }
        WebClient client = webClientBuilder.clone()
                .baseUrl(baseUrl)
                .clientConnector(new ReactorClientHttpConnector(
                        HttpClient.create().responseTimeout(FETCH_TIMEOUT)))
                .exchangeStrategies(ExchangeStrategies.builder()
                        .codecs(codecs -> codecs.defaultCodecs().maxInMemorySize(MAX_BODY_BYTES))
                        .build())
                .build();
        return client.get().uri(path)
                .headers(headers -> {
                    headers.set(HttpHeaders.USER_AGENT, USER_AGENT);
                    headers.set(HttpHeaders.ACCEPT, "text/html,application/xhtml+xml");
                    headers.set(HttpHeaders.ACCEPT_LANGUAGE, "zh-CN,zh;q=0.9,en;q=0.8");
                    headers.set(HttpHeaders.REFERER, baseUrl + "/");
                    headers.set(HttpHeaders.COOKIE, cookie);
                })
                .exchangeToMono(response -> {
                    HttpStatus status = HttpStatus.resolve(response.statusCode().value());
                    String location = response.headers().asHttpHeaders().getFirst(HttpHeaders.LOCATION);
                    if (response.statusCode().is3xxRedirection()
                            && location != null
                            && (location.contains("/403") || location.contains("/login"))) {
                        return response.releaseBody().then(
                                Mono.<String>error(new PlatformCookieMissingException("ACWING")));
                    }
                    if (status == HttpStatus.FORBIDDEN || status == HttpStatus.UNAUTHORIZED) {
                        return response.releaseBody().then(
                                Mono.<String>error(new PlatformCookieMissingException("ACWING")));
                    }
                    if (!response.statusCode().is2xxSuccessful()) {
                        return response.releaseBody().then(response.createException().flatMap(Mono::error));
                    }
                    return response.bodyToMono(String.class);
                });
    }
}
