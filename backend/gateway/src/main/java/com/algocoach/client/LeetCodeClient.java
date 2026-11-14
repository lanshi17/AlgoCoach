package com.algocoach.client;

import com.algocoach.exception.CookieMissingException;
import com.algocoach.model.UserCookie;
import com.algocoach.repository.UserCookieRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.util.Map;
import java.util.function.Function;

/**
 * Thin WebClient wrapper around LeetCode.
 *
 * <p>GraphQL queries still go through {@link #graphql(String, Map)}. Submission and
 * polling use LeetCode's REST endpoints through {@link #post(String, Map)} and
 * {@link #get(String)}. Every call injects the same stored session cookie,
 * {@code x-csrftoken} and {@code Referer} header.</p>
 */
@Component
@RequiredArgsConstructor
public class LeetCodeClient {

    static final String DEFAULT_USER_ID = "default";

    @Value("${leetcode.base-url}")
    private String baseUrl;

    @Value("${leetcode.graphql-path}")
    private String graphqlPath;

    private final UserCookieRepository cookieRepo;
    private final WebClient.Builder webClientBuilder;

    /**
     * Execute a GraphQL query against LeetCode.
     *
     * @param query     GraphQL query string
     * @param variables variable map
     * @return raw JSON response as String (caller parses it)
     */
    public Mono<String> graphql(String query, Map<String, Object> variables) {
        return withCookie(cookie -> newRequest(cookie, HttpMethod.POST, graphqlPath)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("query", query, "variables", variables))
                .retrieve()
                .bodyToMono(String.class));
    }

    /**
     * GET a LeetCode REST path with the stored cookie headers.
     *
     * @param path absolute path below the configured base URL, e.g.
     *             {@code /submissions/detail/123/check/}
     */
    public Mono<String> get(String path) {
        return execute(HttpMethod.GET, path, null);
    }

    /**
     * POST a JSON body to a LeetCode REST path with the stored cookie headers.
     *
     * @param path absolute path below the configured base URL, e.g.
     *             {@code /problems/two-sum/submit/}
     * @param body request JSON body
     */
    public Mono<String> post(String path, Map<String, Object> body) {
        return execute(HttpMethod.POST, path, body);
    }

    private Mono<String> execute(HttpMethod method, String path, Map<String, Object> body) {
        return withCookie(cookie -> {
            WebClient.RequestBodySpec request = newRequest(cookie, method, path);
            WebClient.RequestHeadersSpec<?> prepared = body != null
                    ? request.contentType(MediaType.APPLICATION_JSON).bodyValue(body)
                    : request;
            return prepared.retrieve().bodyToMono(String.class);
        });
    }

    private WebClient.RequestBodySpec newRequest(UserCookie cookie, HttpMethod method, String path) {
        return webClientBuilder
                .baseUrl(baseUrl)
                .build()
                .method(method)
                .uri(path)
                .header(HttpHeaders.COOKIE, "LEETCODE_SESSION=" + cookie.getSession()
                        + "; csrftoken=" + cookie.getCsrf())
                .header("x-csrftoken", cookie.getCsrf())
                .header("Referer", baseUrl + "/");
    }

    /**
     * Resolve the stored cookie on the blocking-friendly scheduler, so the SQLite
     * lookup never runs on the Netty event loop.
     */
    private <T> Mono<T> withCookie(Function<UserCookie, Mono<T>> action) {
        return Mono.fromCallable(() -> cookieRepo.findById(DEFAULT_USER_ID)
                        .orElseThrow(CookieMissingException::new))
                .subscribeOn(Schedulers.boundedElastic())
                .flatMap(action);
    }
}
