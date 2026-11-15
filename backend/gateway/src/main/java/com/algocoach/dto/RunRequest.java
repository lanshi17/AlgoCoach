package com.algocoach.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Request body for a local LeetCode run ({@code interpret_solution}).
 *
 * @param titleSlug LeetCode problem slug, used for the run URL and the problem cache lookup
 * @param code      source code to run
 * @param lang      gateway language key ({@code rust} / {@code cpp} / {@code python3} / {@code typescript} / {@code golang} / {@code java})
 * @param testInput optional custom stdin; when blank the cached sample test case is used
 */
public record RunRequest(
        @NotBlank String titleSlug,
        @NotBlank String code,
        @NotBlank String lang,
        String testInput
) {
}
