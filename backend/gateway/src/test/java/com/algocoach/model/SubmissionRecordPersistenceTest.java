package com.algocoach.model;

import com.algocoach.repository.SubmissionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Exercises the entity against a real SQLite file: persisted columns, UUID
 * generation and the NOT NULL constraints created by {@code ddl-auto: update}.
 */
@SpringBootTest
class SubmissionRecordPersistenceTest {

    private static final Path DB_PATH = temporaryDatabase();

    @DynamicPropertySource
    static void sqliteDatasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> "jdbc:sqlite:" + DB_PATH);
    }

    @Autowired
    private SubmissionRepository repository;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void clearTable() {
        repository.deleteAll();
    }

    @Test
    void persistsEveryColumnAndGeneratesUuid() {
        SubmissionRecord saved = repository.saveAndFlush(SubmissionRecord.builder()
                .problemId("two-sum")
                .platform("LEETCODE")
                .status("ACCEPTED")
                .lang("rust")
                .code("fn main() { println!(\"hi\"); }")
                .runtimeMs(3)
                .memoryMb(12)
                .durationSec(240)
                .createdAt("2026-11-13T03:48:03Z")
                .build());

        assertThat(saved.getId()).isNotNull();
        assertThat(UUID.fromString(saved.getId())).hasToString(saved.getId());

        SubmissionRecord reloaded = repository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getProblemId()).isEqualTo("two-sum");
        assertThat(reloaded.getPlatform()).isEqualTo("LEETCODE");
        assertThat(reloaded.getStatus()).isEqualTo("ACCEPTED");
        assertThat(reloaded.getLang()).isEqualTo("rust");
        assertThat(reloaded.getCode()).isEqualTo("fn main() { println!(\"hi\"); }");
        assertThat(reloaded.getRuntimeMs()).isEqualTo(3);
        assertThat(reloaded.getMemoryMb()).isEqualTo(12);
        assertThat(reloaded.getDurationSec()).isEqualTo(240);
        assertThat(reloaded.getCreatedAt()).isEqualTo("2026-11-13T03:48:03Z");
    }

    @Test
    void generatesDistinctUuidsForEachRecord() {
        SubmissionRecord first = repository.saveAndFlush(record("two-sum", "2026-11-13T03:48:03Z"));
        SubmissionRecord second = repository.saveAndFlush(record("two-sum", "2026-11-13T03:49:03Z"));

        assertThat(first.getId()).isNotEqualTo(second.getId());
        assertThat(UUID.fromString(first.getId())).isNotNull();
        assertThat(UUID.fromString(second.getId())).isNotNull();
    }

    @Test
    void storesIso8601CreatedAtVerbatim() {
        String createdAt = "2026-11-13T03:48:03Z";
        assertThat(Instant.parse(createdAt)).isNotNull();

        SubmissionRecord saved = repository.saveAndFlush(record("two-sum", createdAt));

        assertThat(repository.findById(saved.getId()).orElseThrow().getCreatedAt())
                .isEqualTo(createdAt);
    }

    @Test
    void leavesCodeAndRuntimeColumnsNull() {
        SubmissionRecord saved = repository.saveAndFlush(record("two-sum", "2026-11-13T03:48:03Z"));

        SubmissionRecord reloaded = repository.findById(saved.getId()).orElseThrow();

        assertThat(reloaded.getCode()).isNull();
        assertThat(reloaded.getRuntimeMs()).isNull();
        assertThat(reloaded.getMemoryMb()).isNull();
    }

    @Test
    void schemaDeclaresNullableAndRequiredColumns() {
        Map<String, Map<String, Object>> columns = sqliteColumns();

        assertThat(requiredFlag(columns, "id")).isEqualTo(1);
        assertThat(requiredFlag(columns, "problem_id")).isEqualTo(1);
        assertThat(requiredFlag(columns, "platform")).isEqualTo(1);
        assertThat(requiredFlag(columns, "status")).isEqualTo(1);
        assertThat(requiredFlag(columns, "lang")).isEqualTo(1);
        assertThat(requiredFlag(columns, "duration_sec")).isEqualTo(1);
        assertThat(requiredFlag(columns, "created_at")).isEqualTo(1);

        assertThat(requiredFlag(columns, "code")).isEqualTo(0);
        assertThat(requiredFlag(columns, "runtime_ms")).isEqualTo(0);
        assertThat(requiredFlag(columns, "memory_mb")).isEqualTo(0);

        assertThat(columns.get("code").get("type")).asString().isEqualToIgnoringCase("TEXT");
        assertThat(columns.get("runtime_ms").get("type")).asString().isEqualToIgnoringCase("INTEGER");
        assertThat(columns.get("memory_mb").get("type")).asString().isEqualToIgnoringCase("INTEGER");
    }

    @Test
    void schemaCreatesHistoryIndexes() {
        assertThat(jdbc.queryForList(
                "select name from sqlite_master where type = 'index' and tbl_name = 'submission_record'",
                String.class))
                .contains("idx_submission_problem", "idx_submission_created");

        assertThat(jdbc.queryForList(
                "select name from pragma_index_info('idx_submission_problem')", String.class))
                .containsExactly("problem_id");
        assertThat(jdbc.queryForList(
                "select name from pragma_index_info('idx_submission_created')", String.class))
                .containsExactly("created_at");
    }

    @Test
    void sqliteRejectsNullInEveryRequiredColumn() {
        Map<String, String> requiredValues = new LinkedHashMap<>();
        requiredValues.put("problem_id", "'two-sum'");
        requiredValues.put("platform", "'LEETCODE'");
        requiredValues.put("status", "'ACCEPTED'");
        requiredValues.put("lang", "'rust'");
        requiredValues.put("duration_sec", "42");
        requiredValues.put("created_at", "'2026-11-13T03:48:03Z'");

        for (String omitted : requiredValues.keySet()) {
            StringBuilder columns = new StringBuilder("id");
            StringBuilder values = new StringBuilder("'" + UUID.randomUUID() + "'");
            requiredValues.forEach((column, literal) -> {
                if (!column.equals(omitted)) {
                    columns.append(", ").append(column);
                    values.append(", ").append(literal);
                }
            });

            assertThatThrownBy(() -> jdbc.update(
                    "insert into submission_record (" + columns + ") values (" + values + ")"))
                    .as("missing required column %s", omitted)
                    .isInstanceOf(DataAccessException.class)
                    .hasMessageContaining("NOT NULL");
        }
    }

    private static int requiredFlag(Map<String, Map<String, Object>> columns, String name) {
        return ((Number) columns.get(name).get("required")).intValue();
    }

    private Map<String, Map<String, Object>> sqliteColumns() {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select name, type, \"notnull\" as required from pragma_table_info('submission_record')");

        assertThat(rows).hasSize(10);
        return rows.stream().collect(Collectors.toMap(
                row -> String.valueOf(row.get("name")),
                Function.identity()));
    }

    private static SubmissionRecord record(String problemId, String createdAt) {
        return SubmissionRecord.builder()
                .problemId(problemId)
                .platform("LEETCODE")
                .status("ACCEPTED")
                .lang("rust")
                .durationSec(120)
                .createdAt(createdAt)
                .build();
    }

    private static Path temporaryDatabase() {
        try {
            Path directory = Files.createTempDirectory("gateway-submission-record");
            Path database = directory.resolve("submission.db");
            directory.toFile().deleteOnExit();
            database.toFile().deleteOnExit();
            return database;
        } catch (IOException e) {
            throw new IllegalStateException("Could not prepare the SQLite database", e);
        }
    }
}
