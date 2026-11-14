package com.algocoach.model;

import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

/**
 * Pins the JPA mapping required by the gateway specification: the table name,
 * the history indexes and each column's nullability.
 */
class SubmissionRecordTest {

    @Test
    void mapsToSubmissionRecordTableWithHistoryIndexes() {
        Table table = SubmissionRecord.class.getAnnotation(Table.class);

        assertThat(table).isNotNull();
        assertThat(table.name()).isEqualTo("submission_record");
        assertThat(table.indexes())
                .extracting(Index::name, Index::columnList)
                .containsExactlyInAnyOrder(
                        tuple("idx_submission_problem", "problem_id"),
                        tuple("idx_submission_created", "created_at"));
    }

    @Test
    void idIsAStringUuidGeneratedOnPersist() throws Exception {
        Field id = field("id");

        assertThat(id.getType()).isEqualTo(String.class);
        assertThat(id.getAnnotation(Id.class)).isNotNull();

        GeneratedValue generatedValue = id.getAnnotation(GeneratedValue.class);
        assertThat(generatedValue).isNotNull();
        assertThat(generatedValue.strategy()).isEqualTo(GenerationType.UUID);
    }

    @Test
    void requiredColumnsAreNotNull() throws Exception {
        assertThat(column("problemId").name()).isEqualTo("problem_id");
        assertThat(column("problemId").nullable()).isFalse();

        assertThat(column("platform").nullable()).isFalse();
        assertThat(column("status").nullable()).isFalse();
        assertThat(column("lang").nullable()).isFalse();

        assertThat(column("durationSec").name()).isEqualTo("duration_sec");
        assertThat(column("durationSec").nullable()).isFalse();

        assertThat(column("createdAt").name()).isEqualTo("created_at");
        assertThat(column("createdAt").nullable()).isFalse();
    }

    @Test
    void optionalColumnsAreNullable() throws Exception {
        assertThat(column("code").columnDefinition()).isEqualToIgnoringCase("TEXT");
        assertThat(column("code").nullable()).isTrue();

        assertThat(column("runtimeMs").name()).isEqualTo("runtime_ms");
        assertThat(column("runtimeMs").nullable()).isTrue();

        assertThat(column("memoryMb").name()).isEqualTo("memory_mb");
        assertThat(column("memoryMb").nullable()).isTrue();
    }

    @Test
    void builderAndAccessorsCarryEveryColumn() {
        SubmissionRecord record = SubmissionRecord.builder()
                .id("7ce4a4be-3c5a-4f1e-9a5a-2f3c4d5e6f70")
                .problemId("two-sum")
                .platform("LEETCODE")
                .status("ACCEPTED")
                .lang("rust")
                .code("fn main() {}")
                .runtimeMs(3)
                .memoryMb(12)
                .durationSec(240)
                .createdAt("2026-11-13T03:48:03Z")
                .build();

        assertThat(record.getId()).isEqualTo("7ce4a4be-3c5a-4f1e-9a5a-2f3c4d5e6f70");
        assertThat(record.getProblemId()).isEqualTo("two-sum");
        assertThat(record.getPlatform()).isEqualTo("LEETCODE");
        assertThat(record.getStatus()).isEqualTo("ACCEPTED");
        assertThat(record.getLang()).isEqualTo("rust");
        assertThat(record.getCode()).isEqualTo("fn main() {}");
        assertThat(record.getRuntimeMs()).isEqualTo(3);
        assertThat(record.getMemoryMb()).isEqualTo(12);
        assertThat(record.getDurationSec()).isEqualTo(240);
        assertThat(record.getCreatedAt()).isEqualTo("2026-11-13T03:48:03Z");

        record.setStatus("WRONG_ANSWER");
        assertThat(record.getStatus()).isEqualTo("WRONG_ANSWER");
    }

    private static Column column(String fieldName) throws Exception {
        Column column = field(fieldName).getAnnotation(Column.class);
        assertThat(column).as("column mapping for %s", fieldName).isNotNull();
        return column;
    }

    private static Field field(String name) throws Exception {
        return SubmissionRecord.class.getDeclaredField(name);
    }
}
