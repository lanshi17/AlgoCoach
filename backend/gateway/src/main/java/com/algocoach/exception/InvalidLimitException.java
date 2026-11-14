package com.algocoach.exception;

/**
 * Raised when a history query asks for a non-positive row limit.
 *
 * <p>{@link GlobalExceptionHandler} maps this to the same
 * {@code 400 VALIDATION_ERROR} envelope as a failed request-body validation.</p>
 */
public class InvalidLimitException extends RuntimeException {

    public InvalidLimitException() {
        super("History limit must be positive");
    }
}
