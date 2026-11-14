package com.algocoach.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * Stores the user's LeetCode session cookie.
 * Single-row table (userId = "default" for local single-user MVP).
 */
@Entity
@Table(name = "user_cookie")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class UserCookie {

    @Id
    private String userId;

    @Column(nullable = false)
    private String session;

    @Column(nullable = false)
    private String csrf;

    @Column
    private Long updatedAt;
}
