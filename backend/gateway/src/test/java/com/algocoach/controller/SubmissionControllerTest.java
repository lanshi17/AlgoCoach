package com.algocoach.controller;

import com.algocoach.dto.RunRequest;
import com.algocoach.dto.SubmissionResultDto;
import com.algocoach.dto.SubmitRequest;
import com.algocoach.exception.InvalidLimitException;
import com.algocoach.model.SubmissionRecord;
import com.algocoach.service.SubmissionService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import reactor.core.publisher.Mono;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * MockMvc coverage for the three {@code /api} submission endpoints: the run and
 * submit bodies are dispatched through the real controller (and advice), the reactive
 * results are collected with {@code asyncDispatch}, and the service is always mocked so
 * nothing leaves the JVM.
 */
@WebMvcTest(controllers = SubmissionController.class)
class SubmissionControllerTest {

    private static final String SLUG = "two-sum";
    private static final String CODE = "print(3)";
    private static final String SUBMIT_BODY = """
            {"titleSlug":"two-sum","code":"print(3)","lang":"python3","durationSec":240}
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SubmissionService submissionService;

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void runReturnsTheJudgingJsonAndPassesTheRequestBody() throws Exception {
        JsonNode runResult = mapper.readTree(
                "{\"state\":\"SUCCESS\",\"code_answer\":[\"3\"]}");
        when(submissionService.run(any(RunRequest.class))).thenReturn(Mono.just(runResult));

        performAsync(post("/api/run")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"titleSlug":"two-sum","code":"print(3)","lang":"python3","testInput":"1 2"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("SUCCESS"))
                .andExpect(jsonPath("$.code_answer[0]").value("3"));

        ArgumentCaptor<RunRequest> request = ArgumentCaptor.forClass(RunRequest.class);
        verify(submissionService).run(request.capture());
        assertThat(request.getValue())
                .isEqualTo(new RunRequest(SLUG, CODE, "python3", "1 2"));
    }

    @Test
    void submitValidatesTheBodyAndCallsTheExistingService() throws Exception {
        SubmissionResultDto result =
                new SubmissionResultDto("123", "ACCEPTED", 3, 3, 73, 73, null, 240);
        when(submissionService.submit(any(SubmitRequest.class))).thenReturn(Mono.just(result));

        performAsync(post("/api/submit")
                .contentType(MediaType.APPLICATION_JSON)
                .content(SUBMIT_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("123"))
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.durationSec").value(240));

        ArgumentCaptor<SubmitRequest> request = ArgumentCaptor.forClass(SubmitRequest.class);
        verify(submissionService).submit(request.capture());
        assertThat(request.getValue())
                .isEqualTo(new SubmitRequest(SLUG, CODE, "python3", 240));
    }

    @Test
    void submitRejectsBlankRequiredFieldsWithValidationError() throws Exception {
        mockMvc.perform(post("/api/submit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"titleSlug":"","code":"","lang":"","durationSec":0}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("请求参数校验失败，请检查后重试"));

        verifyNoInteractions(submissionService);
    }

    @Test
    void runRejectsMissingRequiredFieldsWithValidationError() throws Exception {
        mockMvc.perform(post("/api/run")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"titleSlug":"two-sum","code":"print(3)"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        verifyNoInteractions(submissionService);
    }

    @Test
    void historyDefaultsToTwentyRows() throws Exception {
        when(submissionService.history(null, 20))
                .thenReturn(List.of(record("1", "ACCEPTED")));

        mockMvc.perform(get("/api/submissions"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$[0].problemId").value("1"))
                .andExpect(jsonPath("$[0].status").value("ACCEPTED"));

        verify(submissionService).history(null, 20);
    }

    @Test
    void historyPassesProblemFilterAndLimit() throws Exception {
        when(submissionService.history("1", 3)).thenReturn(List.of());

        mockMvc.perform(get("/api/submissions")
                        .param("problemId", "1")
                        .param("limit", "3"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));

        verify(submissionService).history("1", 3);
    }

    @Test
    void nonPositiveLimitReturns400ValidationError() throws Exception {
        when(submissionService.history(null, 0))
                .thenThrow(new InvalidLimitException());

        mockMvc.perform(get("/api/submissions").param("limit", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("请求参数校验失败，请检查后重试"));

        verify(submissionService).history(null, 0);
    }

    private ResultActions performAsync(MockHttpServletRequestBuilder requestBuilder) throws Exception {
        MvcResult asyncResult = mockMvc.perform(requestBuilder)
                .andExpect(request().asyncStarted())
                .andReturn();
        return mockMvc.perform(asyncDispatch(asyncResult));
    }

    private static SubmissionRecord record(String problemId, String status) {
        return SubmissionRecord.builder()
                .id("record-1")
                .problemId(problemId)
                .platform("LEETCODE")
                .status(status)
                .lang("python3")
                .code(CODE)
                .durationSec(240)
                .createdAt("2026-11-13T10:00:00Z")
                .build();
    }
}
