package com.algocoach.service;

import com.algocoach.client.LeetCodeClient;
import com.algocoach.dto.MemoryRecordRequest;
import com.algocoach.dto.RunRequest;
import com.algocoach.dto.SubmissionResultDto;
import com.algocoach.dto.SubmitRequest;
import com.algocoach.exception.InvalidLimitException;
import com.algocoach.exception.SubmissionTimeoutException;
import com.algocoach.model.SubmissionRecord;
import com.algocoach.repository.SubmissionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * LeetCode submission and run flows plus the local submission history.
 *
 * <p>{@link #submit(SubmitRequest)} submits the code, polls until a terminal judging
 * state, then persists one {@link SubmissionRecord}. The LeetCode submit endpoint only
 * returns a {@code submissionId}; the outcome arrives later through the check endpoint.
 * Polling is bounded to {@value #POLL_MAX_ATTEMPTS} attempts
 * {@value #POLL_INTERVAL_MILLIS}ms apart, after which
 * {@link SubmissionTimeoutException} is raised and nothing is stored. Only a terminal
 * result ({@code SUCCESS}, {@code RUNTIME_ERROR} or {@code COMPILE_ERROR}) produces a
 * DTO and a record.</p>
 *
 * <p>{@link #run(RunRequest)} reuses the bounded polling against
 * {@code interpret_solution}: it returns the judging JSON verbatim and never writes a
 * record, because a run is not a formal submission.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SubmissionService {

    static final int POLL_MAX_ATTEMPTS = 20;
    static final long POLL_INTERVAL_MILLIS = 1500;
    static final Duration POLL_INTERVAL = Duration.ofMillis(POLL_INTERVAL_MILLIS);

    static final String PLATFORM = "LEETCODE";

    private static final Set<String> TERMINAL_STATES =
            Set.of("SUCCESS", "RUNTIME_ERROR", "COMPILE_ERROR");
    private static final Pattern LEADING_INTEGER = Pattern.compile("(\\d+)");

    private final LeetCodeClient leetCode;
    private final SubmissionRepository repository;
    private final ProblemCacheService problemCacheService;
    private final ObjectMapper mapper;
    private final AgentMemoryClient agentMemoryClient;

    public Mono<SubmissionResultDto> submit(SubmitRequest request) {
        return problemCacheService.getBySlug(request.titleSlug())
                .flatMap(problem -> {
                    String questionId = questionId(problem);
                    return postSubmit(request, questionId)
                        .flatMap(submissionId -> pollResult(submissionId, request.durationSec(),
                                POLL_MAX_ATTEMPTS))
                        .flatMap(result -> saveRecord(request, questionId, result)
                                .flatMap(saved -> recordMemory(request, problem, saved)));
                });
    }

    private Mono<SubmissionResultDto> recordMemory(
            SubmitRequest request, JsonNode problem, SubmissionResultDto result) {
        MemoryRecordRequest memoryRequest = new MemoryRecordRequest(
                request.titleSlug(),
                PLATFORM,
                result.status(),
                request.lang(),
                request.durationSec(),
                topics(problem));
        return agentMemoryClient.record(memoryRequest)
                .doOnError(error -> log.warn(
                        "Agent memory callback failed for submission {} ({})",
                        result.id(), error.getClass().getSimpleName()))
                .onErrorResume(error -> Mono.empty())
                .thenReturn(result);
    }

    private List<String> topics(JsonNode problem) {
        LinkedHashSet<String> topics = new LinkedHashSet<>();
        JsonNode topicTags = problem.path("topicTags");
        if (topicTags.isArray()) {
            for (JsonNode tag : topicTags) {
                String name = tag.path("nameTranslated").asText("").trim();
                if (name.isBlank()) {
                    name = tag.path("name").asText("").trim();
                }
                if (!name.isBlank()) {
                    topics.add(name);
                }
            }
        }
        return List.copyOf(topics);
    }

    /**
     * Run the sample (or a caller-supplied) test input through LeetCode's
     * {@code interpret_solution} endpoint and return the terminal judging JSON
     * untouched. A run never creates a {@link SubmissionRecord}.
     */
    public Mono<JsonNode> run(RunRequest request) {
        return problemCacheService.getBySlug(request.titleSlug())
                .flatMap(problem -> postInterpret(request, questionId(problem),
                                dataInput(request, problem))
                        .flatMap(interpretId -> pollRun(interpretId, POLL_MAX_ATTEMPTS)));
    }

    /**
     * Newest-first history, optionally narrowed to one LeetCode question. The limit is
     * applied by the database through a {@link Pageable}; a non-positive limit is a
     * caller error rather than a silently empty result.
     */
    public List<SubmissionRecord> history(String problemId, int limit) {
        if (limit <= 0) {
            throw new InvalidLimitException();
        }
        Pageable page = PageRequest.of(0, limit);
        if (problemId == null || problemId.isBlank()) {
            return repository.findAllByOrderByCreatedAtDesc(page);
        }
        return repository.findByProblemIdOrderByCreatedAtDesc(problemId, page);
    }

    /**
     * The submit REST call needs the numeric question id, which the cached problem
     * detail already contains; a cache miss refreshes through the normal read-through path.
     */
    private String questionId(JsonNode problem) {
        String id = problem.path("questionId").asText("");
        if (id.isBlank()) {
            throw new IllegalStateException("Cached problem is missing questionId");
        }
        return id;
    }

    private Mono<String> postSubmit(SubmitRequest request, String questionId) {
        Map<String, Object> body = Map.of(
                "typed_code", request.code(),
                "lang", mapLang(request.lang()),
                "question_id", questionId);
        return leetCode.post("/problems/" + request.titleSlug() + "/submit/", body)
                .map(this::parse)
                .map(json -> json.path("submission_id").asText(""))
                .filter(id -> !id.isBlank())
                .switchIfEmpty(Mono.error(
                        () -> new IllegalStateException("LeetCode submit response is missing submission_id")));
    }

    /**
     * A non-blank custom input wins over the cached sample test case; the sample is the
     * default because it is what the problem page shows the user.
     */
    private String dataInput(RunRequest request, JsonNode problem) {
        if (request.testInput() != null && !request.testInput().isBlank()) {
            return request.testInput();
        }
        return problem.path("sampleTestCase").asText("");
    }

    private Mono<String> postInterpret(RunRequest request, String questionId, String dataInput) {
        Map<String, Object> body = Map.of(
                "typed_code", request.code(),
                "lang", mapLang(request.lang()),
                "question_id", questionId,
                "data_input", dataInput);
        return leetCode.post("/problems/" + request.titleSlug() + "/interpret_solution/", body)
                .map(this::parse)
                .map(json -> json.path("interpret_id").asText(""))
                .filter(id -> !id.isBlank())
                .switchIfEmpty(Mono.error(() -> new IllegalStateException(
                        "LeetCode interpret_solution response is missing interpret_id")));
    }

    /**
     * Bounded polling for a run, mirroring the submit window. Once LeetCode reaches a
     * terminal state the raw check JSON is handed back unchanged.
     */
    private Mono<JsonNode> pollRun(String interpretId, int attemptsLeft) {
        if (attemptsLeft <= 0) {
            return Mono.error(new SubmissionTimeoutException());
        }
        return Mono.delay(POLL_INTERVAL)
                .then(leetCode.get("/submissions/detail/" + interpretId + "/check/"))
                .map(this::parse)
                .flatMap(json -> TERMINAL_STATES.contains(json.path("state").asText(""))
                        ? Mono.just(json)
                        : pollRun(interpretId, attemptsLeft - 1));
    }

    /**
     * Poll the check endpoint until a terminal state, or fail once the attempt budget
     * is exhausted. Each attempt waits before asking LeetCode, matching the documented
     * 20 × 1.5s (30s) upper bound.
     */
    private Mono<SubmissionResultDto> pollResult(String submissionId, int durationSec, int attemptsLeft) {
        if (attemptsLeft <= 0) {
            return Mono.error(new SubmissionTimeoutException());
        }
        return Mono.delay(POLL_INTERVAL)
                .then(leetCode.get("/submissions/detail/" + submissionId + "/check/"))
                .map(this::parse)
                .flatMap(json -> {
                    String state = json.path("state").asText("");
                    if (TERMINAL_STATES.contains(state)) {
                        return Mono.just(toDto(submissionId, json, durationSec));
                    }
                    return pollResult(submissionId, durationSec, attemptsLeft - 1);
                });
    }

    private SubmissionResultDto toDto(String submissionId, JsonNode json, int durationSec) {
        return new SubmissionResultDto(
                submissionId,
                mapStatus(json),
                parseRuntimeMs(json),
                parseMemoryMb(json),
                intOrNull(json, "total_correct"),
                intOrNull(json, "total_testcases"),
                errorMessage(json),
                durationSec);
    }

    /**
     * Persist the terminal outcome. JPA/SQLite calls are blocking, so the write runs on
     * {@link Schedulers#boundedElastic()} instead of the Netty event loop. The record is
     * only written after a terminal result; a polling timeout never reaches this point.
     */
    private Mono<SubmissionResultDto> saveRecord(
            SubmitRequest request, String questionId, SubmissionResultDto result) {
        return Mono.fromCallable(() -> repository.save(SubmissionRecord.builder()
                        .problemId(questionId)
                        .platform(PLATFORM)
                        .status(result.status())
                        .lang(request.lang())
                        .code(request.code())
                        .runtimeMs(result.runtimeMs())
                        .memoryMb(result.memoryMb())
                        .durationSec(request.durationSec())
                        .createdAt(Instant.now().toString())
                        .build()))
                .subscribeOn(Schedulers.boundedElastic())
                .thenReturn(result);
    }

    /**
     * LeetCode reports the human outcome in {@code status_msg} ("Accepted",
     * "Wrong Answer", ...) while {@code state} only describes the judging phase.
     * Normalize to the canonical status names used by the rest of the gateway.
     */
    static String mapStatus(JsonNode json) {
        String raw = json.path("status_msg").asText("").trim();
        if (raw.isEmpty()) {
            raw = json.path("state").asText("").trim();
        }
        if (raw.isEmpty()) {
            return "UNKNOWN";
        }
        String normalized = raw.toUpperCase(Locale.ROOT)
                .replace('-', ' ')
                .replaceAll("\\s+", "_");
        return switch (normalized) {
            case "TIME_LIMIT_EXCEEDED" -> "TIME_LIMIT";
            case "MEMORY_LIMIT_EXCEEDED" -> "MEMORY_LIMIT";
            default -> normalized;
        };
    }

    /** {@code status_runtime} is a display string such as {@code "0 ms"}. */
    static Integer parseRuntimeMs(JsonNode json) {
        String raw = json.path("status_runtime").asText("").trim();
        Matcher matcher = LEADING_INTEGER.matcher(raw);
        return matcher.find() ? Integer.valueOf(matcher.group(1)) : null;
    }

    /**
     * {@code memory} is reported in bytes; the gateway exposes megabytes. LeetCode's
     * UI uses decimal megabytes, so {@code 2048000} bytes is 2 MB.
     */
    static Integer parseMemoryMb(JsonNode json) {
        JsonNode memory = json.get("memory");
        if (memory == null || memory.isNull() || !memory.canConvertToLong()) {
            return null;
        }
        long bytes = memory.asLong();
        return bytes < 0 ? null : (int) Math.round(bytes / 1_000_000.0);
    }

    static Integer intOrNull(JsonNode json, String field) {
        JsonNode value = json.get(field);
        return value != null && value.canConvertToInt() ? value.asInt() : null;
    }

    static String errorMessage(JsonNode json) {
        String compileError = json.path("compile_error").asText("").trim();
        if (!compileError.isEmpty()) {
            return compileError;
        }
        String runtimeError = json.path("runtime_error").asText("").trim();
        return runtimeError.isEmpty() ? null : runtimeError;
    }

    /** LeetCode language keys; unknown keys are forwarded unchanged. */
    static String mapLang(String lang) {
        return switch (lang) {
            case "cpp" -> "cpp";
            case "python3" -> "python3";
            case "rust" -> "rust";
            default -> lang;
        };
    }

    private JsonNode parse(String json) {
        try {
            return mapper.readTree(json);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to parse LeetCode response", e);
        }
    }
}
