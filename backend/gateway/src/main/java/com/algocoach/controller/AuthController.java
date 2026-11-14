package com.algocoach.controller;

import com.algocoach.client.LeetCodeClient;
import com.algocoach.model.UserCookie;
import com.algocoach.repository.UserCookieRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.Map;

/**
 * POST /api/auth/cookie  — save LeetCode session + csrf cookies
 * GET  /api/auth/status  — check if cookie is present
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final String AUTH_QUERY = """
            query authStatus { userStatus { isSignedIn } }
            """;

    private final UserCookieRepository cookieRepo;
    private final LeetCodeClient leetCodeClient;
    private final ObjectMapper objectMapper;

    record CookieRequest(@NotBlank String session, @NotBlank String csrf) {}

    @PostMapping("/cookie")
    public ResponseEntity<Void> saveCookie(@Valid @RequestBody CookieRequest req) {
        cookieRepo.save(new UserCookie("default", req.session(), req.csrf(), System.currentTimeMillis()));
        return ResponseEntity.ok().build();
    }

    @GetMapping("/status")
    public ResponseEntity<?> status() {
        boolean present = cookieRepo.existsById("default");
        return ResponseEntity.ok(java.util.Map.of("authenticated", present));
    }

    @GetMapping("/validate")
    public Mono<ResponseEntity<Map<String, Boolean>>> validate() {
        if (!cookieRepo.existsById("default")) {
            return Mono.just(ResponseEntity.ok(Map.of("authenticated", false)));
        }
        return leetCodeClient.graphql(AUTH_QUERY, Map.of())
                .map(raw -> {
                    try {
                        JsonNode json = objectMapper.readTree(raw);
                        boolean signedIn = json.path("data").path("userStatus")
                                .path("isSignedIn").asBoolean(false);
                        if (!signedIn) {
                            cookieRepo.deleteById("default");
                        }
                        return ResponseEntity.ok(Map.of("authenticated", signedIn));
                    } catch (Exception ignored) {
                        cookieRepo.deleteById("default");
                        return ResponseEntity.ok(Map.of("authenticated", false));
                    }
                });
    }
}
