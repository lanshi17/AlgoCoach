package com.algocoach.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Request body for a formal LeetCode submission.
 *
 * @param titleSlug   LeetCode problem slug, used for the submit URL and the problem cache lookup
 * @param code        source code to submit
 * @param lang        gateway language key ({@code rust} / {@code cpp} / {@code python3})
 * @param durationSec time the user spent in FOCUS mode, supplied by the frontend
 */
public record SubmitRequest(
        @NotBlank String titleSlug,
        @NotBlank String code,
        @NotBlank String lang,
        int durationSec
) {
}
