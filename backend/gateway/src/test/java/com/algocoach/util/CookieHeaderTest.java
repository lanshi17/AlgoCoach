package com.algocoach.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CookieHeaderTest {

    @Test
    void extractsCookieFromPastedCurl() {
        String curl = """
                curl 'https://www.acwing.com/problem/search/1/?page=1' \\
                  -H 'cookie: csrftoken=abc; sessionid=def; other=1' \\
                  -H 'user-agent: Mozilla/5.0'
                """;
        assertThat(CookieHeader.normalize(curl)).isEqualTo("csrftoken=abc; sessionid=def; other=1");
    }

    @Test
    void extractsDashBCookieArgument() {
        assertThat(CookieHeader.normalize("curl 'https://x.test' -b 'a=b; c=d'"))
                .isEqualTo("a=b; c=d");
    }

    @Test
    void stripsControlCharactersFromRawHeader() {
        assertThat(CookieHeader.normalize("PHPSESSID=abc;\r\n  exesubmitlang=0\n"))
                .isEqualTo("PHPSESSID=abc; exesubmitlang=0");
    }

    @Test
    void rejectsACommandWhoseCookieHeaderWasNotLocated() {
        assertThat(CookieHeader.normalize(
                "curl 'https://www.acwing.com/problem/search/1/?page=1' -H 'user-agent: Mozilla/5.0'"))
                .isNull();
    }

    @Test
    void ignoresSetCookieHeader() {
        assertThat(CookieHeader.normalize("-H 'set-cookie: PHPSESSID=evil; Path=/'")).isNull();
    }

    @Test
    void rejectsValuesWithoutCookiePair() {
        assertThat(CookieHeader.normalize("curl 'https://x.test' -H 'user-agent: x'")).isNull();
        assertThat(CookieHeader.normalize("   ")).isNull();
        assertThat(CookieHeader.normalize(null)).isNull();
    }
}
