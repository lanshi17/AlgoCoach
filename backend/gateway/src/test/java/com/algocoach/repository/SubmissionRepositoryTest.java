package com.algocoach.repository;

import com.algocoach.model.SubmissionRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

/**
 * Pins the derived history queries: optional problem filtering, newest-first
 * ordering, and no hidden row limit (limiting belongs to the service layer).
 */
@SpringBootTest
class SubmissionRepositoryTest {

    private static final Path DB_PATH = temporaryDatabase();

    @DynamicPropertySource
    static void sqliteDatasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> "jdbc:sqlite:" + DB_PATH);
    }

    @Autowired
    private SubmissionRepository repository;

    @BeforeEach
    void clearTable() {
        repository.deleteAll();
    }

    @Test
    void allHistoryIsNewestFirst() {
        persist("two-sum", "2026-11-13T10:00:00Z");
        persist("add-two-numbers", "2026-11-13T12:00:00Z");
        persist("two-sum", "2026-11-13T11:00:00Z");

        assertThat(repository.findAllByOrderByCreatedAtDesc())
                .extracting(SubmissionRecord::getCreatedAt)
                .containsExactly(
                        "2026-11-13T12:00:00Z",
                        "2026-11-13T11:00:00Z",
                        "2026-11-13T10:00:00Z");
    }

    @Test
    void filtersByProblemAndKeepsNewestFirst() {
        persist("two-sum", "2026-11-13T10:00:00Z");
        persist("add-two-numbers", "2026-11-13T10:30:00Z");
        persist("two-sum", "2026-11-13T12:00:00Z");
        persist("add-two-numbers", "2026-11-13T11:30:00Z");
        persist("two-sum", "2026-11-13T11:00:00Z");

        assertThat(repository.findByProblemIdOrderByCreatedAtDesc("two-sum"))
                .extracting(SubmissionRecord::getProblemId, SubmissionRecord::getCreatedAt)
                .containsExactly(
                        tuple("two-sum", "2026-11-13T12:00:00Z"),
                        tuple("two-sum", "2026-11-13T11:00:00Z"),
                        tuple("two-sum", "2026-11-13T10:00:00Z"));
    }

    @Test
    void unknownProblemHasNoHistory() {
        persist("two-sum", "2026-11-13T10:00:00Z");

        assertThat(repository.findByProblemIdOrderByCreatedAtDesc("three-sum")).isEmpty();
    }

    @Test
    void problemQueryReturnsEveryMatchWithoutLimit() {
        int records = 25;
        IntStream.rangeClosed(1, records).forEach(day -> persist(
                "two-sum",
                "2026-11-%02dT10:00:00Z".formatted(day)));

        assertThat(repository.findByProblemIdOrderByCreatedAtDesc("two-sum"))
                .hasSize(records)
                .extracting(SubmissionRecord::getCreatedAt)
                .first()
                .isEqualTo("2026-11-25T10:00:00Z");
    }

    @Test
    void pageableLimitIsAppliedByTheDatabase() {
        int records = 25;
        IntStream.rangeClosed(1, records).forEach(day -> persist(
                "two-sum",
                "2026-11-%02dT10:00:00Z".formatted(day)));

        assertThat(repository.findByProblemIdOrderByCreatedAtDesc(
                "two-sum", PageRequest.of(0, 10)))
                .hasSize(10)
                .extracting(SubmissionRecord::getCreatedAt)
                .containsExactly(
                        "2026-11-25T10:00:00Z",
                        "2026-11-24T10:00:00Z",
                        "2026-11-23T10:00:00Z",
                        "2026-11-22T10:00:00Z",
                        "2026-11-21T10:00:00Z",
                        "2026-11-20T10:00:00Z",
                        "2026-11-19T10:00:00Z",
                        "2026-11-18T10:00:00Z",
                        "2026-11-17T10:00:00Z",
                        "2026-11-16T10:00:00Z");
    }

    @Test
    void pageableLimitAlsoAppliesWithoutAProblemFilter() {
        IntStream.rangeClosed(1, 25).forEach(day -> persist(
                "problem-" + day,
                "2026-11-%02dT10:00:00Z".formatted(day)));

        assertThat(repository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 4)))
                .extracting(SubmissionRecord::getCreatedAt)
                .containsExactly(
                        "2026-11-25T10:00:00Z",
                        "2026-11-24T10:00:00Z",
                        "2026-11-23T10:00:00Z",
                        "2026-11-22T10:00:00Z");
    }

    private void persist(String problemId, String createdAt) {
        repository.saveAndFlush(SubmissionRecord.builder()
                .problemId(problemId)
                .platform("LEETCODE")
                .status("ACCEPTED")
                .lang("rust")
                .durationSec(60)
                .createdAt(createdAt)
                .build());
    }

    private static Path temporaryDatabase() {
        try {
            Path directory = Files.createTempDirectory("gateway-submission-repository");
            Path database = directory.resolve("submission.db");
            directory.toFile().deleteOnExit();
            database.toFile().deleteOnExit();
            return database;
        } catch (IOException e) {
            throw new IllegalStateException("Could not prepare the SQLite database", e);
        }
    }
}
