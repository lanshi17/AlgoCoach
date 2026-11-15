package com.algocoach.exception;

/**
 * Raised when a platform request needs a stored cookie but none is configured
 * (or the upstream rejected it). Mapped to {@code 401 COOKIE_MISSING}.
 */
public class PlatformCookieMissingException extends RuntimeException {

    private final String platform;

    public PlatformCookieMissingException(String platform) {
        super(platform + " Cookie 未设置或已过期，请在设置页填写");
        this.platform = platform;
    }

    public String platform() {
        return platform;
    }
}
