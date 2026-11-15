package com.algocoach.controller;

import com.algocoach.model.PlatformCookie;
import com.algocoach.util.CookieHeader;
import com.algocoach.model.UserCookie;
import com.algocoach.repository.UserCookieRepository;
import com.algocoach.repository.PlatformCookieRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Cookie storage for non-LeetCode platforms ({@code ACWING}, {@code HDU}).
 *
 * <p>The raw {@code Cookie} header is written to the local SQLite database and
 * is never echoed back; status only reports whether a row exists.</p>
 */
@RestController
@RequestMapping("/api/platforms")
@RequiredArgsConstructor
public class PlatformCookieController {

    static final Set<String> SUPPORTED = Set.of("ACWING", "HDU");

    record CookieRequest(@NotBlank String cookie) {}

    private final PlatformCookieRepository cookieRepo;
    private final UserCookieRepository leetCodeCookieRepo;

    /** 统一状态入口：三个题库平台的登录态一眼可见。 */
    @GetMapping
    public Map<String, Boolean> statusAll() {
        return Map.of(
                "LEETCODE", leetCodeCookieRepo.existsById("default"),
                "ACWING", cookieRepo.existsById("ACWING"),
                "HDU", cookieRepo.existsById("HDU"));
    }

    @PostMapping("/{platform}/cookie")
    public ResponseEntity<Void> save(@PathVariable String platform, @Valid @RequestBody CookieRequest req) {
        String key = normalize(platform);
        if (key == null) {
            return ResponseEntity.badRequest().build();
        }
        String cookie = CookieHeader.normalize(req.cookie());
        if (cookie == null) {
            return ResponseEntity.badRequest().build();
        }
        cookieRepo.save(new PlatformCookie(key, cookie, System.currentTimeMillis()));
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{platform}/status")
    public ResponseEntity<Map<String, Boolean>> status(@PathVariable String platform) {
        String key = normalize(platform);
        if (key == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(Map.of("configured", cookieRepo.existsById(key)));
    }

    static String normalize(String platform) {
        String key = platform == null ? "" : platform.strip().toUpperCase(Locale.ROOT);
        return SUPPORTED.contains(key) ? key : null;
    }
}
