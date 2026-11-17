package com.algocoach.exception;

import com.algocoach.dto.ErrorResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.context.request.async.AsyncRequestTimeoutException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.concurrent.TimeoutException;

/**
 * Maps every gateway failure to the uniform {@code {status, code, message}}
 * envelope.
 *
 * <p>Responses only ever contain the fixed messages declared here. Exception
 * messages, upstream response bodies, stack traces and cookie values stay on
 * the server (or are omitted entirely), never in the response body.</p>
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    static final String COOKIE_MISSING_CODE = "COOKIE_MISSING";
    static final String COOKIE_EXPIRED_CODE = "COOKIE_EXPIRED";
    static final String RATE_LIMITED_CODE = "RATE_LIMITED";
    static final String UPSTREAM_ERROR_CODE = "UPSTREAM_ERROR";
    static final String UPSTREAM_TIMEOUT_CODE = "UPSTREAM_TIMEOUT";
    static final String SUBMISSION_TIMEOUT_CODE = "SUBMISSION_TIMEOUT";
    static final String VALIDATION_ERROR_CODE = "VALIDATION_ERROR";
    static final String NOT_FOUND_CODE = "NOT_FOUND";
    static final String UPLOAD_TOO_LARGE_CODE = "UPLOAD_TOO_LARGE";
    static final String INTERNAL_ERROR_CODE = "INTERNAL_ERROR";

    static final String COOKIE_MISSING_MESSAGE = "LeetCode Cookie 未设置，请在设置页面粘贴 Cookie";
    static final String COOKIE_EXPIRED_MESSAGE = "LeetCode Cookie 已过期，请重新粘贴";
    static final String RATE_LIMITED_MESSAGE = "LeetCode 请求频率限制，请稍后再试";
    static final String UPSTREAM_ERROR_MESSAGE = "上游服务暂时不可用，请稍后重试";
    static final String UPSTREAM_TIMEOUT_MESSAGE = "上游服务响应超时，请稍后重试";
    static final String SUBMISSION_TIMEOUT_MESSAGE = "提交结果获取超时，请到 LeetCode 官网查看";
    static final String VALIDATION_ERROR_MESSAGE = "请求参数校验失败，请检查后重试";
    static final String NOT_FOUND_MESSAGE = "请求的资源不存在";
    static final String UPLOAD_TOO_LARGE_MESSAGE = "上传文件过大，单文件最多 20 MB、单次最多 100 MB";
    static final String INTERNAL_ERROR_MESSAGE = "服务器内部错误，请稍后再试";

    @ExceptionHandler(CookieMissingException.class)
    public ResponseEntity<ErrorResponse> handleCookieMissing(CookieMissingException e) {
        log.warn("Rejecting request: no LeetCode cookie configured");
        return error(HttpStatus.UNAUTHORIZED, COOKIE_MISSING_CODE, COOKIE_MISSING_MESSAGE);
    }

    @ExceptionHandler(PlatformCookieMissingException.class)
    public ResponseEntity<ErrorResponse> handlePlatformCookieMissing(PlatformCookieMissingException e) {
        log.warn("Rejecting request: no {} cookie configured", e.platform());
        return error(HttpStatus.UNAUTHORIZED, COOKIE_MISSING_CODE, e.getMessage());
    }

    @ExceptionHandler(ProblemStatementUnavailableException.class)
    public ResponseEntity<ErrorResponse> handleProblemStatementUnavailable(ProblemStatementUnavailableException e) {
        log.warn("Upstream problem page did not contain a recognizable statement");
        return error(HttpStatus.BAD_GATEWAY, UPSTREAM_ERROR_CODE,
                "无法读取题面，请检查题目是否存在、平台登录状态或稍后重试");
    }

    @ExceptionHandler(WebClientResponseException.class)
    public ResponseEntity<ErrorResponse> handleUpstreamResponse(WebClientResponseException e) {
        int upstreamStatus = e.getStatusCode().value();
        if (upstreamStatus == 401) {
            return error(HttpStatus.UNAUTHORIZED, COOKIE_EXPIRED_CODE, COOKIE_EXPIRED_MESSAGE);
        }
        if (upstreamStatus == 429) {
            return error(HttpStatus.TOO_MANY_REQUESTS, RATE_LIMITED_CODE, RATE_LIMITED_MESSAGE);
        }
        // Log only the upstream status: the upstream body must never reach the client or the log.
        log.warn("LeetCode upstream request failed with status {}", upstreamStatus);
        return error(HttpStatus.BAD_GATEWAY, UPSTREAM_ERROR_CODE, UPSTREAM_ERROR_MESSAGE);
    }

    @ExceptionHandler(WebClientRequestException.class)
    public ResponseEntity<ErrorResponse> handleUpstreamRequest(WebClientRequestException e) {
        if (isTimeout(e)) {
            log.warn("Upstream request timed out");
            return timeout();
        }
        log.warn("Upstream request failed before receiving a response: {}", e.getClass().getSimpleName());
        return error(HttpStatus.BAD_GATEWAY, UPSTREAM_ERROR_CODE, UPSTREAM_ERROR_MESSAGE);
    }

    @ExceptionHandler(TimeoutException.class)
    public ResponseEntity<ErrorResponse> handleTimeout(TimeoutException e) {
        log.warn("Upstream request timed out");
        return timeout();
    }

    @ExceptionHandler(AsyncRequestTimeoutException.class)
    public ResponseEntity<ErrorResponse> handleAsyncTimeout(AsyncRequestTimeoutException e) {
        log.warn("Gateway async request timed out");
        return timeout();
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        // Field names could be logged, field values must not.
        log.warn("Request body validation failed ({} field error(s))", e.getFieldErrorCount());
        return error(HttpStatus.BAD_REQUEST, VALIDATION_ERROR_CODE, VALIDATION_ERROR_MESSAGE);
    }

    @ExceptionHandler(SubmissionTimeoutException.class)
    public ResponseEntity<ErrorResponse> handleSubmissionTimeout(SubmissionTimeoutException e) {
        log.warn("LeetCode submission result polling timed out");
        return error(HttpStatus.SERVICE_UNAVAILABLE, SUBMISSION_TIMEOUT_CODE, SUBMISSION_TIMEOUT_MESSAGE);
    }

    @ExceptionHandler(InvalidLimitException.class)
    public ResponseEntity<ErrorResponse> handleInvalidLimit(InvalidLimitException e) {
        log.warn("Rejected submission history query: non-positive limit");
        return error(HttpStatus.BAD_REQUEST, VALIDATION_ERROR_CODE, VALIDATION_ERROR_MESSAGE);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadableBody(HttpMessageNotReadableException e) {
        log.warn("Request body could not be parsed");
        return error(HttpStatus.BAD_REQUEST, VALIDATION_ERROR_CODE, VALIDATION_ERROR_MESSAGE);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResource(NoResourceFoundException e) {
        log.debug("Static resource not found");
        return error(HttpStatus.NOT_FOUND, NOT_FOUND_CODE, NOT_FOUND_MESSAGE);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleUploadTooLarge(MaxUploadSizeExceededException e) {
        log.warn("Knowledge upload exceeded the configured multipart limit");
        return error(HttpStatus.PAYLOAD_TOO_LARGE, UPLOAD_TOO_LARGE_CODE, UPLOAD_TOO_LARGE_MESSAGE);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception e) {
        log.error("Unhandled gateway error", e);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, INTERNAL_ERROR_CODE, INTERNAL_ERROR_MESSAGE);
    }

    private static ResponseEntity<ErrorResponse> timeout() {
        return error(HttpStatus.GATEWAY_TIMEOUT, UPSTREAM_TIMEOUT_CODE, UPSTREAM_TIMEOUT_MESSAGE);
    }

    private static ResponseEntity<ErrorResponse> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(new ErrorResponse(status.value(), code, message));
    }

    /**
     * Reactor Netty surfaces response timeouts as {@code ReadTimeoutException}
     * and connect timeouts as {@code ConnectTimeoutException}; both extend
     * {@link TimeoutException}. Walk the cause chain because WebClient wraps
     * them in {@link WebClientRequestException}.
     */
    private static boolean isTimeout(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof TimeoutException) {
                return true;
            }
            if (current.getCause() == current) {
                break;
            }
            current = current.getCause();
        }
        return false;
    }
}
