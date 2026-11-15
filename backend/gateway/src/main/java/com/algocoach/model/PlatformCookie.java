package com.algocoach.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * Stores a raw {@code Cookie} header for one non-LeetCode platform.
 * The row is keyed by the platform id ({@code ACWING}, {@code HDU}) and is
 * written only by the local settings page; the value is never logged or
 * returned to the client.
 */
@Entity
@Table(name = "platform_cookie")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class PlatformCookie {

    @Id
    private String platform;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String cookie;

    @Column
    private Long updatedAt;
}
