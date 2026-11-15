package com.algocoach.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Turns whatever the user pasted — a raw {@code Cookie} header or a whole
 * browser "Copy as cURL" command — into a single-line header value.
 *
 * <p>HTTP header values cannot contain CR/LF or other control characters; a
 * pasted cURL carries those by definition, so the gateway must normalise
 * before storing the value or handing it to the upstream client.</p>
 */
public final class CookieHeader {

    /** {@code -b '...'} / {@code --cookie "..."} with optional {@code $'...'} form. */
    private static final Pattern CURL_COOKIE_ARG =
            Pattern.compile("(?:^|\\s)(?:-b|--cookie)\\s+(?:\\$)?(['\"])([\\s\\S]*?)\\1");

    /** A {@code cookie: ...} header line, e.g. inside {@code -H 'cookie: ...'}. */
    private static final Pattern CURL_COOKIE_LINE =
            Pattern.compile("(?:-H\\s*)?['\"]?(?<![\\w-])cookie\\s*:\\s*([^'\"\\r\\n]+)",
                    Pattern.CASE_INSENSITIVE);

    private static final Pattern CONTROL = Pattern.compile("\\p{Cntrl}");

    /** {@code name=value; name=value} — anything else is not a Cookie header. */
    private static final Pattern COOKIE_HEADER =
            Pattern.compile("^[A-Za-z0-9_.\\-]+=[^;]*(?:; *[A-Za-z0-9_.\\-]+=[^;]*)*$");

    private CookieHeader() {}

    /**
     * @return a {@code name=value; name=value} header, or {@code null} when the
     *         input does not contain a usable cookie pair.
     */
    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String header = extract(raw);
        if (header == null) {
            return null;
        }
        String cleaned = CONTROL.matcher(header).replaceAll("");
        cleaned = cleaned.replaceAll("\\s*;\\s*", "; ")
                .replaceAll("\\s+", " ")
                .replaceAll("(?:;\\s*)+$", "")
                .strip();
        return COOKIE_HEADER.matcher(cleaned).matches() ? cleaned : null;
    }

    private static String extract(String raw) {
        Matcher arg = CURL_COOKIE_ARG.matcher(raw);
        if (arg.find()) {
            return arg.group(2);
        }
        Matcher line = CURL_COOKIE_LINE.matcher(raw);
        if (line.find()) {
            return line.group(1);
        }
        return raw;
    }
}
