package com.algocoach.dto;

/**
 * Uniform error envelope returned by every gateway endpoint.
 *
 * <p>{@code message} is always a fixed user-facing text. Exception messages,
 * upstream response bodies, stack traces and cookie values must never be
 * placed in this object.</p>
 */
public record ErrorResponse(int status, String code, String message) {
}
