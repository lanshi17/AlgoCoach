package com.algocoach.exception;

/**
 * Raised when LeetCode never reaches a terminal judging state within the polling
 * budget (20 attempts, 1.5s apart) for a formal submission or a local run.
 *
 * <p>{@link GlobalExceptionHandler} maps this to {@code 503 SUBMISSION_TIMEOUT}.
 * No submission record is written for a timed-out submission; a run never writes
 * a record in any case.</p>
 */
public class SubmissionTimeoutException extends RuntimeException {

    public SubmissionTimeoutException() {
        super("LeetCode submission result polling timed out");
    }
}
