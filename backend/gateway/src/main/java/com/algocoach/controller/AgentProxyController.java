package com.algocoach.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.Disposable;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;

import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import io.netty.channel.ChannelOption;

/**
 * Transparent HTTP proxy from {@code /api/agent/**} to the Python FastAPI agent.
 *
 * <p>The frontend only needs the gateway port (8080); every agent call is forwarded to
 * the single, configured {@code agent.base-url}. The upstream host is fixed at startup
 * and can never be selected by the incoming request: only routes registered by
 * {@code backend/agent/app/agent/router.py} are mapped, the upstream
 * path is a constant, and only the request's raw query string is appended. The profile and export endpoints are registered as fixed gateway routes.</p>
 *
 * <p>Requests are forwarded with the original method, raw query string and raw body.
 * Only the headers the agent needs are copied: {@code Content-Type} (so FastAPI can
 * parse the body) and {@code Authorization} (required for the Bearer token on
 * {@code /animate/generated}). Hop-by-hop headers such as {@code Host},
 * {@code Connection}, {@code Transfer-Encoding} and {@code Upgrade}, and caller cookies,
 * are deliberately never forwarded.</p>
 *
 * <p>Responses are returned unchanged: the upstream status code, raw body and
 * {@code Content-Type} are preserved, together with the retry/authentication headers
 * the client needs ({@code Retry-After} for 429 and {@code WWW-Authenticate} for 401).
 * The WebClient {@code exchangeToMono} API is used on purpose so upstream 4xx/5xx
 * responses are proxied as responses instead of being turned into exceptions;
 * transport failures still propagate to {@code GlobalExceptionHandler} and become the
 * uniform gateway error envelope.</p>
 */
@RestController
@RequestMapping(AgentProxyController.BASE_PATH)
public class AgentProxyController {

    /** Model generation can exceed the gateway's short I/O timeout. */
    static final Duration CHAT_RESPONSE_TIMEOUT = Duration.ofSeconds(120);
    /** Spring MVC's default async timeout is shorter; leave room beyond the HTTP timeout. */
    static final Duration CHAT_ASYNC_TIMEOUT = Duration.ofSeconds(125);
    /** Knowledge indexing may call a remote embedding provider for a large upload. */
    static final Duration KNOWLEDGE_RESPONSE_TIMEOUT = Duration.ofSeconds(180);
    static final Duration KNOWLEDGE_ASYNC_TIMEOUT = Duration.ofSeconds(185);
    static final int CONNECT_TIMEOUT_MILLIS = 5_000;

    /** Public gateway prefix; the FastAPI service does not use it. */
    public static final String BASE_PATH = "/api/agent";

    static final String CHAT_STREAM_PATH = "/chat/stream";
    static final String CHAT_REPLAY_PATH = "/chat/replay";
    static final String MEMORY_RECORD_PATH = "/memory/record";
    static final String MEMORY_PROFILE_PATH = "/memory/profile";
    static final String MEMORY_MASTERY_PATH = "/memory/mastery-path";
    static final String MEMORY_EXPORT_PATH = "/memory/export";
    static final String KNOWLEDGE_CONFIG_PATH = "/knowledge/config";
    static final String KNOWLEDGE_SOURCES_PATH = "/knowledge/sources";
    static final String KNOWLEDGE_REINDEX_PATH = "/knowledge/reindex";
    static final String KNOWLEDGE_STATUS_PATH = "/knowledge/status";
    static final String ANIMATE_PATH = "/animate";
    static final String ANIMATE_GENERATED_PATH = "/animate/generated";
    static final String ANIMATE_STATUS_PATH = "/animate/";

    /**
     * Response headers that carry meaning for the caller. Everything else is
     * dropped: transport-level headers must not be copied from upstream.
     */
    static final Set<String> FORWARDED_RESPONSE_HEADERS = Set.of(
            HttpHeaders.CONTENT_TYPE,
            HttpHeaders.RETRY_AFTER,
            HttpHeaders.WWW_AUTHENTICATE);

    private final WebClient agentClient;
    private final WebClient agentChatClient;
    private final WebClient agentKnowledgeClient;
    private final String agentBaseUrl;

    public AgentProxyController(
            WebClient.Builder webClientBuilder,
            @Value("${agent.base-url}") String agentBaseUrl) {
        this.agentBaseUrl = normalizeBaseUrl(agentBaseUrl);
        // Clone the shared builder so this client never mutates the LeetCode client's
        // builder, and build the WebClient once instead of per request.
        this.agentClient = webClientBuilder.clone().build();
        this.agentChatClient = webClientBuilder.clone()
                .clientConnector(new ReactorClientHttpConnector(createChatHttpClient()))
                .build();
        this.agentKnowledgeClient = webClientBuilder.clone()
                .clientConnector(new ReactorClientHttpConnector(createKnowledgeHttpClient()))
                .build();
    }

    static HttpClient createChatHttpClient() {
        return HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, CONNECT_TIMEOUT_MILLIS)
                .responseTimeout(CHAT_RESPONSE_TIMEOUT);
    }

    static HttpClient createKnowledgeHttpClient() {
        return HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, CONNECT_TIMEOUT_MILLIS)
                .responseTimeout(KNOWLEDGE_RESPONSE_TIMEOUT);
    }

    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseBodyEmitter chatStream(
            HttpServletRequest request,
            @RequestBody(required = false) byte[] body) {
        ResponseBodyEmitter emitter = new ResponseBodyEmitter(CHAT_ASYNC_TIMEOUT.toMillis());
        WebClient.RequestBodySpec preparedRequest = agentChatClient.method(HttpMethod.POST)
                .uri(upstreamUri(CHAT_STREAM_PATH, request.getQueryString()))
                .headers(headers -> copyRequestHeaders(request, headers));
        WebClient.RequestHeadersSpec<?> requestWithBody =
                body != null ? preparedRequest.bodyValue(body) : preparedRequest;
        Disposable upstream = requestWithBody.exchangeToFlux(response ->
                        response.bodyToFlux(byte[].class))
                .subscribe(
                        chunk -> {
                            try {
                                emitter.send(chunk);
                            } catch (Exception sendFailure) {
                                emitter.completeWithError(sendFailure);
                            }
                        },
                        emitter::completeWithError,
                        emitter::complete);
        emitter.onTimeout(upstream::dispose);
        emitter.onCompletion(upstream::dispose);
        return emitter;
    }

    @PostMapping("/chat/replay")
    public Mono<ResponseEntity<byte[]>> replayChatTurn(
            HttpServletRequest request,
            @RequestBody(required = false) byte[] body) {
        return forward(HttpMethod.POST, CHAT_REPLAY_PATH, request, body);
    }

    @PostMapping("/memory/record")
    public Mono<ResponseEntity<byte[]>> recordMemory(
            HttpServletRequest request,
            @RequestBody(required = false) byte[] body) {
        return forward(HttpMethod.POST, MEMORY_RECORD_PATH, request, body);
    }

    @GetMapping("/memory/profile")
    public Mono<ResponseEntity<byte[]>> memoryProfile(HttpServletRequest request) {
        return forward(HttpMethod.GET, MEMORY_PROFILE_PATH, request, null);
    }

    @GetMapping("/memory/mastery-path")
    public Mono<ResponseEntity<byte[]>> memoryMasteryPath(HttpServletRequest request) {
        return forward(HttpMethod.GET, MEMORY_MASTERY_PATH, request, null);
    }

    @GetMapping("/memory/export")
    public Mono<ResponseEntity<byte[]>> memoryExport(HttpServletRequest request) {
        return forward(HttpMethod.GET, MEMORY_EXPORT_PATH, request, null);
    }

    @GetMapping("/knowledge/config")
    public Mono<ResponseEntity<byte[]>> knowledgeConfig(HttpServletRequest request) {
        return forwardKnowledge(HttpMethod.GET, KNOWLEDGE_CONFIG_PATH, request, null);
    }

    @org.springframework.web.bind.annotation.PutMapping("/knowledge/config")
    public Mono<ResponseEntity<byte[]>> updateKnowledgeConfig(
            HttpServletRequest request, @RequestBody(required = false) byte[] body) {
        return forwardKnowledge(HttpMethod.PUT, KNOWLEDGE_CONFIG_PATH, request, body);
    }

    @GetMapping("/knowledge/sources")
    public Mono<ResponseEntity<byte[]>> knowledgeSources(HttpServletRequest request) {
        return forwardKnowledge(HttpMethod.GET, KNOWLEDGE_SOURCES_PATH, request, null);
    }

    @PostMapping("/knowledge/sources")
    public Mono<ResponseEntity<byte[]>> uploadKnowledgeSources(
            HttpServletRequest request, @RequestPart("files") List<MultipartFile> files) {
        MultipartBodyBuilder multipart = new MultipartBodyBuilder();
        for (MultipartFile file : files) {
            try {
                byte[] bytes = file.getBytes();
                String filename = file.getOriginalFilename() == null
                        ? "source.txt" : file.getOriginalFilename();
                multipart.part("files", new ByteArrayResource(bytes) {
                    @Override
                    public String getFilename() {
                        return filename;
                    }
                });
            } catch (java.io.IOException ex) {
                return Mono.error(ex);
            }
        }
        return forwardKnowledgeMultipart(HttpMethod.POST, KNOWLEDGE_SOURCES_PATH, request,
                multipart.build());
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/knowledge/sources/{sourceId}")
    public Mono<ResponseEntity<byte[]>> deleteKnowledgeSource(
            @PathVariable String sourceId, HttpServletRequest request) {
        return forwardKnowledge(HttpMethod.DELETE, KNOWLEDGE_SOURCES_PATH + "/" + sourceId, request, null);
    }

    @PostMapping("/knowledge/reindex")
    public Mono<ResponseEntity<byte[]>> reindexKnowledge(HttpServletRequest request) {
        return forwardKnowledge(HttpMethod.POST, KNOWLEDGE_REINDEX_PATH, request, null);
    }

    @GetMapping("/knowledge/status")
    public Mono<ResponseEntity<byte[]>> knowledgeStatus(HttpServletRequest request) {
        return forwardKnowledge(HttpMethod.GET, KNOWLEDGE_STATUS_PATH, request, null);
    }

    @PostMapping("/animate")
    public Mono<ResponseEntity<byte[]>> animate(
            HttpServletRequest request,
            @RequestBody(required = false) byte[] body) {
        return forward(HttpMethod.POST, ANIMATE_PATH, request, body);
    }

    @PostMapping("/animate/generated")
    public Mono<ResponseEntity<byte[]>> animateGenerated(
            HttpServletRequest request,
            @RequestBody(required = false) byte[] body) {
        return forward(HttpMethod.POST, ANIMATE_GENERATED_PATH, request, body);
    }

    @GetMapping("/animate/{jobId}")
    public Mono<ResponseEntity<byte[]>> animateStatus(
            @PathVariable String jobId,
            HttpServletRequest request) {
        return forward(HttpMethod.GET, ANIMATE_STATUS_PATH + jobId, request, null);
    }

    private Mono<ResponseEntity<byte[]>> forward(
            HttpMethod method,
            String upstreamPath,
            HttpServletRequest request,
            byte[] body) {
        return forward(agentClient, method, upstreamPath, request, body);
    }

    private Mono<ResponseEntity<byte[]>> forwardKnowledge(
            HttpMethod method,
            String upstreamPath,
            HttpServletRequest request,
            byte[] body) {
        return forward(agentKnowledgeClient, method, upstreamPath, request, body);
    }

    private Mono<ResponseEntity<byte[]>> forward(
            WebClient client,
            HttpMethod method,
            String upstreamPath,
            HttpServletRequest request,
            byte[] body) {
        WebClient.RequestBodySpec preparedRequest = client.method(method)
                .uri(upstreamUri(upstreamPath, request.getQueryString()))
                .headers(headers -> copyRequestHeaders(request, headers));

        WebClient.RequestHeadersSpec<?> requestWithBody =
                body != null ? preparedRequest.bodyValue(body) : preparedRequest;

        return requestWithBody.exchangeToMono(response ->
                response.bodyToMono(byte[].class)
                        .defaultIfEmpty(new byte[0])
                        .map(responseBody -> ResponseEntity.status(response.statusCode())
                                .headers(headers -> copyResponseHeaders(
                                        response.headers().asHttpHeaders(), headers))
                                .body(responseBody)));
    }

    private Mono<ResponseEntity<byte[]>> forwardMultipart(
            HttpMethod method, String upstreamPath, HttpServletRequest request,
            MultiValueMap<String, org.springframework.http.HttpEntity<?>> body) {
        return forwardMultipart(agentClient, method, upstreamPath, request, body);
    }

    private Mono<ResponseEntity<byte[]>> forwardKnowledgeMultipart(
            HttpMethod method, String upstreamPath, HttpServletRequest request,
            MultiValueMap<String, org.springframework.http.HttpEntity<?>> body) {
        return forwardMultipart(agentKnowledgeClient, method, upstreamPath, request, body);
    }

    private Mono<ResponseEntity<byte[]>> forwardMultipart(
            WebClient client, HttpMethod method, String upstreamPath, HttpServletRequest request,
            MultiValueMap<String, org.springframework.http.HttpEntity<?>> body) {
        WebClient.RequestBodySpec preparedRequest = client.method(method)
                .uri(upstreamUri(upstreamPath, request.getQueryString()))
                .headers(headers -> headers.setContentType(MediaType.MULTIPART_FORM_DATA));
        return preparedRequest.body(BodyInserters.fromMultipartData(body))
                .exchangeToMono(response -> response.bodyToMono(byte[].class)
                        .defaultIfEmpty(new byte[0])
                        .map(responseBody -> ResponseEntity.status(response.statusCode())
                                .headers(headers -> copyResponseHeaders(
                                        response.headers().asHttpHeaders(), headers))
                                .body(responseBody)));
    }

    /**
     * Builds the absolute upstream URI from three separately trusted pieces: the
     * configured base URL, a constant route path, and the request's raw query string.
     * Because the base URL and path are never taken from the request, a caller cannot
     * turn this proxy into an open proxy for another host.
     */
    private URI upstreamUri(String upstreamPath, String rawQuery) {
        String target = agentBaseUrl + upstreamPath;
        if (rawQuery != null && !rawQuery.isEmpty()) {
            target = target + "?" + rawQuery;
        }
        return URI.create(target);
    }

    private static void copyRequestHeaders(HttpServletRequest request, HttpHeaders headers) {
        String contentType = request.getContentType();
        if (contentType != null && !contentType.isBlank()) {
            headers.set(HttpHeaders.CONTENT_TYPE, contentType);
        }
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization != null && !authorization.isBlank()) {
            headers.set(HttpHeaders.AUTHORIZATION, authorization);
        }
    }

    private static void copyResponseHeaders(HttpHeaders upstreamHeaders, HttpHeaders headers) {
        for (String name : FORWARDED_RESPONSE_HEADERS) {
            for (String value : upstreamHeaders.getOrDefault(name, List.of())) {
                headers.add(name, value);
            }
        }
    }

    /**
     * Trims whitespace and trailing slashes so {@code http://host:8000/} and
     * {@code http://host:8000} produce the same target URI.
     */
    static String normalizeBaseUrl(String configuredBaseUrl) {
        if (configuredBaseUrl == null || configuredBaseUrl.isBlank()) {
            throw new IllegalStateException("agent.base-url must be configured");
        }
        String normalized = configuredBaseUrl.trim();
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        if (normalized.isEmpty()) {
            throw new IllegalStateException("agent.base-url must be configured");
        }
        return normalized;
    }
}
