package com.algocoach.client;

import com.algocoach.model.PlatformCookie;
import com.algocoach.repository.PlatformCookieRepository;
import com.algocoach.util.CookieHeader;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.nio.charset.Charset;

/**
 * WebClient for HDU pages. HDU serves GB18030 HTML; the stored cookie is
 * optional (it only adds "solved" markers) and is attached when present.
 */
@Component
@RequiredArgsConstructor
public class HduClient {

    static final Charset GB18030 = Charset.forName("GB18030");
    static final String USER_AGENT =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                    + "(KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36";

    @Value("${hdu.base-url}")
    private String baseUrl;

    private final PlatformCookieRepository cookieRepo;
    private final WebClient.Builder webClientBuilder;

    public Mono<String> get(String pathWithQuery) {
        String cookie = cookieRepo.findById("HDU")
                .map(PlatformCookie::getCookie)
                .map(CookieHeader::normalize)
                .orElse(null);
        WebClient client = webClientBuilder.clone().baseUrl(baseUrl).build();
        return client.get().uri(pathWithQuery)
                .headers(headers -> {
                    headers.set(HttpHeaders.USER_AGENT, USER_AGENT);
                    headers.set(HttpHeaders.ACCEPT, "text/html,application/xhtml+xml");
                    headers.set(HttpHeaders.ACCEPT_LANGUAGE, "zh-CN,zh;q=0.9,en;q=0.8");
                    headers.set(HttpHeaders.REFERER, baseUrl + "/");
                    if (cookie != null && !cookie.isBlank()) {
                        headers.set(HttpHeaders.COOKIE, cookie);
                    }
                })
                .retrieve()
                .bodyToMono(byte[].class)
                .map(bytes -> new String(bytes, GB18030));
    }
}
