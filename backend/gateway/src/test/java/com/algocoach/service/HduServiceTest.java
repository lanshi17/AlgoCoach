package com.algocoach.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import com.algocoach.exception.ProblemStatementUnavailableException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Pins the HDU parsing: embedded p(...) list calls and GB18030 statement panels. */
class HduServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final HduService service = new HduService(null, mapper);

    private static final String LIST = """
            <script>
            p(0,1000,5,"A + B Problem",339973,1153148);p(1,1001,0,"Sum Problem",204852,798885);
            </script>
            <a href=listproblem.php?vol=32>32</a>
            """;

    private static final String DETAIL = """
            <h1 style='color:#1A5CC8'>A + B Problem</h1>
            <span>Time Limit: 2000/1000 MS (Java/Others)    Memory Limit: 65536/32768 K (Java/Others)</span>
            <div class=panel_title align=left>Problem Description</div> <div class=panel_content>Calculate <i>A + B</i>.<br></div>
            <div class=panel_bottom>&nbsp;</div>
            <div class=panel_title align=left>Sample Input</div><div class=panel_content><pre><div style="font-family:Courier New,Courier,monospace">1 1</div></pre></div>
            <div class=panel_bottom>&nbsp;</div>
            <div class=panel_title align=left>Sample Output</div><div class=panel_content><pre>2</pre></div>
            <div class=panel_bottom>&nbsp;</div>
            """;

    @Test
    void listParsesEmbeddedCallsAndVolumeCount() {
        JsonNode out = service.normalizeList(1, LIST);

        assertThat(out.path("total").asInt()).isEqualTo(32 * 100);
        assertThat(out.path("problems")).hasSize(2);
        assertThat(out.path("problems").get(0).path("platformId").asText()).isEqualTo("1000");
    }

    @Test
    void detailExtractsPanelsAndShipsTemplates() {
        JsonNode out = service.normalizeDetail("1000", DETAIL);

        assertThat(out.path("title").asText()).isEqualTo("A + B Problem");
        assertThat(out.path("contentHtml").asText())
                .contains("<h4>Problem Description</h4>").contains("Sample Input").contains("2000 ms");
        assertThat(out.path("sampleTestCases").asText()).isEqualTo("1 1");
        // The sample panel wraps its payload in a nested <div>; the panel must still
        // close at its footer or the following panels are swallowed.
        String content = out.path("contentHtml").asText();
        assertThat(count(content, "<pre>")).isEqualTo(count(content, "</pre>"));
        assertThat(content).contains("Sample Output");
        assertThat(out.path("codeSnippets")).hasSize(6);
    }

    private static int count(String haystack, String needle) {
        int total = 0;
        for (int i = haystack.indexOf(needle); i >= 0; i = haystack.indexOf(needle, i + needle.length())) {
            total++;
        }
        return total;
    }

    @Test
    void rejectsErrorPagesWithoutAProblemDescription() {
        assertThatThrownBy(() -> service.normalizeDetail("1000", "<h1>Problem not found</h1>"))
                .isInstanceOf(ProblemStatementUnavailableException.class);
    }
}
