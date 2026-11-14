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
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Submission flow tests with a fake LeetCode client and Reactor virtual time: the
 * 20 × 1.5s polling window is simulated instead of waited out, and no request ever
 * leaves the JVM.
 */
@ExtendWith(MockitoExtension.class)
class SubmissionServiceTest {

    private static final String SLUG = "two-sum";
    private static final String CODE = "fn main() { println!(\"hi\"); }";
    private static final String SUBMIT_PATH = "/problems/two-sum/submit/";
    private static final String CHECK_PATH = "/submissions/detail/123/check/";
    private static final String INTERPRET_PATH = "/problems/two-sum/interpret_solution/";
    private static final String RUN_CHECK_PATH = "/submissions/detail/run-1/check/";

    private static final String PENDING = """
            {"state":"PENDING"}
            """;
    private static final String RUN_SUCCEEDED = """
            {"state":"SUCCESS","status_msg":"Accepted","code_answer":["3"],
             "expected_code_answer":["3"],"std_output_list":[""],"total_correct":2,
             "total_testcases":2}
            """;
    private static final String ACCEPTED = """
            {"state":"SUCCESS","status_msg":"Accepted","status_runtime":"3 ms",
             "memory":3145728,"total_correct":73,"total_testcases":73,
             "compile_error":"","runtime_error":""}
            """;
    private static final String COMPILE_ERROR = """
            {"state":"COMPILE_ERROR","status_msg":"Compile Error","status_runtime":"N/A",
             "memory":0,"total_correct":0,"total_testcases":5,
             "compile_error":"Line 1: expected `;`"}
            """;
    private static final String RUNTIME_ERROR = """
            {"state":"RUNTIME_ERROR","status_msg":"Runtime Error","status_runtime":"N/A",
             "memory":1024000,"total_correct":2,"total_testcases":5,
             "runtime_error":"IndexError: list index out of range"}
            """;

    @Mock
    private LeetCodeClient leetCode;

    @Mock
    private SubmissionRepository repository;

    @Mock
    private ProblemCacheService problemCacheService;

    @Mock
    private AgentMemoryClient agentMemoryClient;

    private final ObjectMapper mapper = new ObjectMapper();

    private SubmissionService service;

    @BeforeEach
    void setUp() {
        lenient().when(agentMemoryClient.record(any())).thenReturn(Mono.empty());
        service = new SubmissionService(leetCode, repository, problemCacheService, mapper, agentMemoryClient);
    }

    @Test
    @SuppressWarnings("unchecked")
    void pendingThenAcceptedPollsToTerminalAndSavesCompleteRecord() throws Exception {
        SubmitRequest request = new SubmitRequest(SLUG, CODE, "rust", 240);
        stubCachedQuestionId("1");
        ArgumentCaptor<Map<String, Object>> submittedBody = ArgumentCaptor.forClass(Map.class);
        when(leetCode.post(eq(SUBMIT_PATH), submittedBody.capture()))
                .thenReturn(Mono.just("{\"submission_id\":123}"));
        when(leetCode.get(CHECK_PATH))
                .thenReturn(Mono.just(PENDING), Mono.just(PENDING), Mono.just(ACCEPTED));

        when(repository.save(any(SubmissionRecord.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        StepVerifier.withVirtualTime(() -> service.submit(request))
                .expectSubscription()
                .thenAwait(Duration.ofSeconds(5))
                .assertNext(result -> assertAccepted(result, 240))
                .verifyComplete();

        assertThat(submittedBody.getValue())
                .containsEntry("typed_code", CODE)
                .containsEntry("lang", "rust")
                .containsEntry("question_id", "1");
        verify(problemCacheService).getBySlug(SLUG);
        verify(leetCode, times(3)).get(CHECK_PATH);

        ArgumentCaptor<SubmissionRecord> saved = ArgumentCaptor.forClass(SubmissionRecord.class);
        verify(repository).save(saved.capture());
        SubmissionRecord record = saved.getValue();
        assertThat(record.getProblemId()).isEqualTo("1");
        assertThat(record.getPlatform()).isEqualTo("LEETCODE");
        assertThat(record.getStatus()).isEqualTo("ACCEPTED");
        assertThat(record.getLang()).isEqualTo("rust");
        assertThat(record.getCode()).isEqualTo(CODE);
        assertThat(record.getRuntimeMs()).isEqualTo(3);
        assertThat(record.getMemoryMb()).isEqualTo(3);
        assertThat(record.getDurationSec()).isEqualTo(240);
        assertThat(Instant.parse(record.getCreatedAt()).toString()).isEqualTo(record.getCreatedAt());
        ArgumentCaptor<MemoryRecordRequest> memoryRequest = ArgumentCaptor.forClass(MemoryRecordRequest.class);
        verify(agentMemoryClient).record(memoryRequest.capture());
        assertThat(memoryRequest.getValue()).isEqualTo(new MemoryRecordRequest(
                "two-sum", "LEETCODE", "ACCEPTED", "rust", 240, List.of("数组")));
    }

    @Test
    void compileErrorIsTerminalAndSavedWithoutPollingAgain() throws Exception {
        SubmitRequest request = new SubmitRequest(SLUG, CODE, "cpp", 12);
        stubCachedQuestionId("1");
        when(leetCode.post(eq(SUBMIT_PATH), any()))
                .thenReturn(Mono.just("{\"submission_id\":123}"));
        when(leetCode.get(CHECK_PATH)).thenReturn(Mono.just(COMPILE_ERROR));

        StepVerifier.withVirtualTime(() -> service.submit(request))
                .expectSubscription()
                .thenAwait(Duration.ofSeconds(2))
                .assertNext(result -> {
                    assertThat(result.id()).isEqualTo("123");
                    assertThat(result.status()).isEqualTo("COMPILE_ERROR");
                    assertThat(result.errorMessage()).isEqualTo("Line 1: expected `;`");
                    assertThat(result.runtimeMs()).isNull();
                    assertThat(result.memoryMb()).isZero();
                    assertThat(result.passedTests()).isZero();
                    assertThat(result.totalTests()).isEqualTo(5);
                    assertThat(result.durationSec()).isEqualTo(12);
                })
                .verifyComplete();

        verify(leetCode, times(1)).get(CHECK_PATH);
        ArgumentCaptor<SubmissionRecord> saved = ArgumentCaptor.forClass(SubmissionRecord.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo("COMPILE_ERROR");
        assertThat(saved.getValue().getLang()).isEqualTo("cpp");
    }

    @Test
    void runtimeErrorIsTerminalAndSaved() throws Exception {
        SubmitRequest request = new SubmitRequest(SLUG, CODE, "python3", 30);
        stubCachedQuestionId("1");
        when(leetCode.post(eq(SUBMIT_PATH), any()))
                .thenReturn(Mono.just("{\"submission_id\":123}"));
        when(leetCode.get(CHECK_PATH)).thenReturn(Mono.just(RUNTIME_ERROR));

        StepVerifier.withVirtualTime(() -> service.submit(request))
                .expectSubscription()
                .thenAwait(Duration.ofSeconds(2))
                .assertNext(result -> {
                    assertThat(result.status()).isEqualTo("RUNTIME_ERROR");
                    assertThat(result.errorMessage())
                            .isEqualTo("IndexError: list index out of range");
                    assertThat(result.memoryMb()).isEqualTo(1);
                    assertThat(result.passedTests()).isEqualTo(2);
                    assertThat(result.totalTests()).isEqualTo(5);
                })
                .verifyComplete();

        verify(repository).save(any(SubmissionRecord.class));
    }

    @Test
    void memoryCallbackFailureDoesNotDiscardPersistedSubmission() throws Exception {
        SubmitRequest request = new SubmitRequest(SLUG, CODE, "rust", 18);
        stubCachedQuestionId("1");
        when(leetCode.post(eq(SUBMIT_PATH), any())).thenReturn(Mono.just("{\"submission_id\":123}"));
        when(leetCode.get(CHECK_PATH)).thenReturn(Mono.just(ACCEPTED));
        when(repository.save(any(SubmissionRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(agentMemoryClient.record(any())).thenReturn(Mono.error(new IllegalStateException("agent offline")));

        StepVerifier.withVirtualTime(() -> service.submit(request))
                .expectSubscription()
                .thenAwait(Duration.ofSeconds(2))
                .assertNext(result -> assertAccepted(result, 18))
                .verifyComplete();

        verify(repository).save(any(SubmissionRecord.class));
        verify(agentMemoryClient).record(any());
    }

    @Test
    void exhaustedPollingThrowsTimeoutAndNeverSaves() throws Exception {
        SubmitRequest request = new SubmitRequest(SLUG, CODE, "rust", 60);
        stubCachedQuestionId("1");
        when(leetCode.post(eq(SUBMIT_PATH), any()))
                .thenReturn(Mono.just("{\"submission_id\":123}"));
        when(leetCode.get(CHECK_PATH)).thenReturn(Mono.just(PENDING));

        StepVerifier.withVirtualTime(() -> service.submit(request))
                .expectSubscription()
                .thenAwait(Duration.ofSeconds(31))
                .expectError(SubmissionTimeoutException.class)
                .verify();

        verify(leetCode, times(SubmissionService.POLL_MAX_ATTEMPTS)).get(CHECK_PATH);
        verify(repository, never()).save(any());
    }

    @Test
    void mapsLeetCodeStatusMessagesToCanonicalStatuses() throws Exception {
        assertThat(SubmissionService.mapStatus(mapper.readTree(
                "{\"status_msg\":\"Accepted\"}"))).isEqualTo("ACCEPTED");
        assertThat(SubmissionService.mapStatus(mapper.readTree(
                "{\"status_msg\":\"Wrong Answer\"}"))).isEqualTo("WRONG_ANSWER");
        assertThat(SubmissionService.mapStatus(mapper.readTree(
                "{\"status_msg\":\"Time Limit Exceeded\"}"))).isEqualTo("TIME_LIMIT");
        assertThat(SubmissionService.mapStatus(mapper.readTree(
                "{\"status_msg\":\"Memory Limit Exceeded\"}"))).isEqualTo("MEMORY_LIMIT");
        assertThat(SubmissionService.mapStatus(mapper.readTree(
                "{\"status_msg\":\"Runtime Error\"}"))).isEqualTo("RUNTIME_ERROR");
        assertThat(SubmissionService.mapStatus(mapper.readTree(
                "{\"status_msg\":\"Compile Error\"}"))).isEqualTo("COMPILE_ERROR");
        // status_msg absent: fall back to the judging state.
        assertThat(SubmissionService.mapStatus(mapper.readTree(
                "{\"state\":\"PENDING\"}"))).isEqualTo("PENDING");
    }

    @Test
    @SuppressWarnings("unchecked")
    void runUsesCustomTestInputAndReturnsRawJsonWithoutSaving() throws Exception {
        RunRequest request = new RunRequest(SLUG, CODE, "python3", "1 2\n");
        stubCachedProblem("1", "sample-input");
        ArgumentCaptor<Map<String, Object>> body = ArgumentCaptor.forClass(Map.class);
        when(leetCode.post(eq(INTERPRET_PATH), body.capture()))
                .thenReturn(Mono.just("{\"interpret_id\":\"run-1\"}"));
        when(leetCode.get(RUN_CHECK_PATH))
                .thenReturn(Mono.just(PENDING), Mono.just(RUN_SUCCEEDED));

        StepVerifier.withVirtualTime(() -> service.run(request))
                .expectSubscription()
                .thenAwait(Duration.ofSeconds(5))
                .assertNext(json -> {
                    assertThat(json.path("state").asText()).isEqualTo("SUCCESS");
                    assertThat(json.path("status_msg").asText()).isEqualTo("Accepted");
                    assertThat(json.path("code_answer").get(0).asText()).isEqualTo("3");
                    assertThat(json.path("total_testcases").asInt()).isEqualTo(2);
                })
                .verifyComplete();

        assertThat(body.getValue())
                .containsEntry("typed_code", CODE)
                .containsEntry("lang", "python3")
                .containsEntry("question_id", "1")
                .containsEntry("data_input", "1 2\n");
        verify(problemCacheService).getBySlug(SLUG);
        verify(leetCode, times(2)).get(RUN_CHECK_PATH);
        verifyNoInteractions(repository);
    }

    @Test
    @SuppressWarnings("unchecked")
    void runFallsBackToCachedSampleTestCaseWhenTestInputIsBlank() throws Exception {
        RunRequest request = new RunRequest(SLUG, CODE, "cpp", "   ");
        stubCachedProblem("42", "sample-and-custom");
        ArgumentCaptor<Map<String, Object>> body = ArgumentCaptor.forClass(Map.class);
        when(leetCode.post(eq(INTERPRET_PATH), body.capture()))
                .thenReturn(Mono.just("{\"interpret_id\":\"run-1\"}"));
        when(leetCode.get(RUN_CHECK_PATH)).thenReturn(Mono.just(RUN_SUCCEEDED));

        StepVerifier.withVirtualTime(() -> service.run(request))
                .expectSubscription()
                .thenAwait(Duration.ofSeconds(2))
                .expectNextCount(1)
                .verifyComplete();

        assertThat(body.getValue())
                .containsEntry("question_id", "42")
                .containsEntry("lang", "cpp")
                .containsEntry("data_input", "sample-and-custom");
        verifyNoInteractions(repository);
    }

    @Test
    void runPollingExhaustionTimesOutWithoutSaving() throws Exception {
        RunRequest request = new RunRequest(SLUG, CODE, "rust", null);
        stubCachedProblem("1", "sample-input");
        when(leetCode.post(eq(INTERPRET_PATH), any()))
                .thenReturn(Mono.just("{\"interpret_id\":\"run-1\"}"));
        when(leetCode.get(RUN_CHECK_PATH)).thenReturn(Mono.just(PENDING));

        StepVerifier.withVirtualTime(() -> service.run(request))
                .expectSubscription()
                .thenAwait(Duration.ofSeconds(31))
                .expectError(SubmissionTimeoutException.class)
                .verify();

        verify(leetCode, times(SubmissionService.POLL_MAX_ATTEMPTS)).get(RUN_CHECK_PATH);
        verifyNoInteractions(repository);
    }

    @Test
    void historyAppliesProblemFilterAndLimitThroughPageable() throws Exception {
        SubmissionRecord record = SubmissionRecord.builder().problemId("1").build();
        ArgumentCaptor<Pageable> page = ArgumentCaptor.forClass(Pageable.class);
        when(repository.findByProblemIdOrderByCreatedAtDesc(eq("1"), page.capture()))
                .thenReturn(List.of(record));

        assertThat(service.history("1", 5)).containsExactly(record);

        assertThat(page.getValue().getPageNumber()).isZero();
        assertThat(page.getValue().getPageSize()).isEqualTo(5);
        verify(repository, never()).findAllByOrderByCreatedAtDesc(any(Pageable.class));
    }

    @Test
    void historyWithoutProblemQueriesAllRowsNewestFirst() throws Exception {
        SubmissionRecord record = SubmissionRecord.builder().problemId("1").build();
        when(repository.findAllByOrderByCreatedAtDesc(any(Pageable.class)))
                .thenReturn(List.of(record));

        assertThat(service.history(null, 20)).containsExactly(record);

        verify(repository, never())
                .findByProblemIdOrderByCreatedAtDesc(any(), any(Pageable.class));
    }

    @Test
    void historyRejectsNonPositiveLimit() {
        assertThatThrownBy(() -> service.history(null, 0))
                .isInstanceOf(InvalidLimitException.class);
        assertThatThrownBy(() -> service.history("1", -3))
                .isInstanceOf(InvalidLimitException.class);
        verifyNoInteractions(repository);
    }

    private void stubCachedProblem(String questionId, String sampleTestCase) throws Exception {
        when(problemCacheService.getBySlug(SLUG))
                .thenReturn(Mono.just(mapper.readTree(
                        "{\"questionId\":\"" + questionId + "\",\"title\":\"Two Sum\","
                                + "\"sampleTestCase\":\"" + sampleTestCase + "\"}")));
    }

    private void stubCachedQuestionId(String questionId) throws Exception {
        when(problemCacheService.getBySlug(SLUG))
                .thenReturn(Mono.just(mapper.readTree(
                        "{\"questionId\":\"" + questionId + "\",\"title\":\"Two Sum\","
                                + "\"topicTags\":[{\"name\":\"Array\",\"nameTranslated\":\"数组\"}]}")));
    }

    private static void assertAccepted(SubmissionResultDto result, int durationSec) {
        assertThat(result.id()).isEqualTo("123");
        assertThat(result.status()).isEqualTo("ACCEPTED");
        assertThat(result.runtimeMs()).isEqualTo(3);
        assertThat(result.memoryMb()).isEqualTo(3);
        assertThat(result.passedTests()).isEqualTo(73);
        assertThat(result.totalTests()).isEqualTo(73);
        assertThat(result.errorMessage()).isNull();
        assertThat(result.durationSec()).isEqualTo(durationSec);
    }
}
