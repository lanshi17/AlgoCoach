package com.algocoach.model;

import jakarta.persistence.Index;
import jakarta.persistence.Table;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins the {@code cached_at} index both as declared on the entity and as it actually
 * lands in SQLite. The database starts from the pre-index table shape, so the schema
 * update path has to add the index to an existing table, exactly like an upgraded
 * {@code data/algocoach.db}.
 */
@SpringBootTest
class ProblemCacheSchemaTest {

    private static final String INDEX_NAME = "idx_problem_cache_cached_at";
    private static final Path DB_PATH = legacyDatabaseWithoutIndex();

    @DynamicPropertySource
    static void sqliteDatasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> "jdbc:sqlite:" + DB_PATH);
    }

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void entityDeclaresTheCachedAtIndex() {
        Table table = ProblemCache.class.getAnnotation(Table.class);

        assertThat(table).isNotNull();
        assertThat(table.indexes())
                .filteredOn(index -> INDEX_NAME.equals(index.name()))
                .singleElement()
                .extracting(Index::columnList)
                .isEqualTo("cached_at");
    }

    @Test
    void schemaUpdateCreatesTheIndexOnAnExistingTable() {
        List<String> indexes = jdbc.queryForList(
                "select name from sqlite_master where type = 'index' and tbl_name = 'problem_cache'",
                String.class);

        assertThat(indexes).contains(INDEX_NAME);
        assertThat(jdbc.queryForList(
                "select name from pragma_index_info('" + INDEX_NAME + "')", String.class))
                .containsExactly("cached_at");
    }

    private static Path legacyDatabaseWithoutIndex() {
        try {
            Path directory = Files.createTempDirectory("gateway-problem-cache-schema");
            Path database = directory.resolve("legacy.db");
            try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + database);
                 Statement statement = connection.createStatement()) {
                statement.execute("""
                        create table problem_cache (
                            title_slug   text primary key,
                            content_json text not null,
                            cached_at    integer not null
                        )
                        """);
            }
            directory.toFile().deleteOnExit();
            database.toFile().deleteOnExit();
            return database;
        } catch (Exception e) {
            throw new IllegalStateException("Could not prepare the legacy SQLite schema", e);
        }
    }
}
