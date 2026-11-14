package com.algocoach.dto;

/**
 * Result of one formal submission, assembled from the final LeetCode poll response.
 *
 * @param id          LeetCode submission id
 * @param status      canonical outcome ({@code ACCEPTED} / {@code WRONG_ANSWER} / ...)
 * @param runtimeMs   reported runtime, or {@code null} when LeetCode did not report one
 * @param memoryMb    reported memory converted to megabytes, or {@code null}
 * @param passedTests number of passed test cases, or {@code null}
 * @param totalTests  total number of test cases, or {@code null}
 * @param errorMessage compile/runtime error text, or {@code null}
 * @param durationSec time the user spent in FOCUS mode
 */
public record SubmissionResultDto(
        String id,
        String status,
        Integer runtimeMs,
        Integer memoryMb,
        Integer passedTests,
        Integer totalTests,
        String errorMessage,
        int durationSec
) {
}
