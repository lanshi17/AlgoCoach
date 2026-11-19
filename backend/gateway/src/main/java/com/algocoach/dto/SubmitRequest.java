package com.algocoach.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Request body for a formal LeetCode submission.
 *
 * @param titleSlug   LeetCode problem slug, used for the submit URL and the problem cache lookup
 * @param code        source code to submit
 * @param lang        gateway language key ({@code rust} / {@code cpp} / {@code python3} / {@code typescript} / {@code golang} / {@code java})
 * @param durationSec time the user spent in FOCUS mode, supplied by the frontend
 * @param workspaceId local learning workspace that should receive the memory callback
 */
public record SubmitRequest(
        @NotBlank String titleSlug,
        @NotBlank String code,
        @NotBlank String lang,
        int durationSec,
        @NotBlank String workspaceId
) {
    public SubmitRequest(String titleSlug, String code, String lang, int durationSec) {
        this(titleSlug, code, lang, durationSec, "local-default");
    }

    public SubmitRequest {
        workspaceId = workspaceId == null || workspaceId.isBlank()
                ? "local-default" : workspaceId.trim();
    }
}
