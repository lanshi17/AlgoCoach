package com.algocoach.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * One LeetCode submission stored for the user's history.
 *
 * <p>The row keeps the code as submitted together with the judging outcome and the
 * time the user spent in FOCUS mode. {@code createdAt} is an ISO 8601 string so the
 * value stored in SQLite is directly readable and sorts chronologically.</p>
 */
@Entity
@Table(name = "submission_record", indexes = {
        @Index(name = "idx_submission_problem", columnList = "problem_id"),
        @Index(name = "idx_submission_created", columnList = "created_at")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@Builder
public class SubmissionRecord {

    /** Server-generated UUID; assigned when the record is first persisted. */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /** LeetCode questionId. */
    @Column(name = "problem_id", nullable = false)
    private String problemId;

    /** Source platform, e.g. {@code "LEETCODE"}. */
    @Column(nullable = false)
    private String platform;

    /** Judging outcome, e.g. {@code ACCEPTED} / {@code WRONG_ANSWER}. */
    @Column(nullable = false)
    private String status;

    /** Submission language, e.g. {@code rust} / {@code cpp} / {@code python3}. */
    @Column(nullable = false)
    private String lang;

    /** Submitted code; nullable because older rows may not retain it. */
    @Column(columnDefinition = "TEXT")
    private String code;

    /** Runtime reported by LeetCode; null while unknown. */
    @Column(name = "runtime_ms")
    private Integer runtimeMs;

    /** Memory reported by LeetCode; null while unknown. */
    @Column(name = "memory_mb")
    private Integer memoryMb;

    /** Time the user spent in FOCUS mode, in seconds. */
    @Column(name = "duration_sec", nullable = false)
    private Integer durationSec;

    /** ISO 8601 creation timestamp. */
    @Column(name = "created_at", nullable = false)
    private String createdAt;
}
