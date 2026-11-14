package com.algocoach.exception;

/**
 * Raised when a LeetCode request needs a stored cookie but none is configured.
 *
 * <p>This is deliberately a dedicated type instead of a generic
 * {@link IllegalStateException}: only this exception is mapped to
 * {@code 401 COOKIE_MISSING}, so unrelated state errors still fall through to
 * the generic {@code 500 INTERNAL_ERROR} handler.</p>
 */
public class CookieMissingException extends RuntimeException {

    public CookieMissingException() {
        super("LeetCode cookie is not configured");
    }
}
