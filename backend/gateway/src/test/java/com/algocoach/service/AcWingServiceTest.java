package com.algocoach.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import com.algocoach.exception.ProblemStatementUnavailableException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Pins the AcWing parsing: list rows (title/tags/difficulty/pages), the
 * statement page (content block, sample, limits), per-language templates and
 * the tag-search keyword cleanup.
 */
class AcWingServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final AcWingService service = new AcWingService(null, mapper);

    private static final String LIST = """
            <table><tbody>
            <tr>
              <td><a id="problem-title-1" href="/problem/content/1/" target="_blank">A + B</a></td>
              <td><div id="problem-keywords-1"></div><script>let keywords = "<span class='es-search-highlight'>模拟</span>,数学";</script></td>
              <td><span class="label label-success round">简单</span></td>
            </tr>
            </tbody></table>
            <a name="page_turning" id="page_1" href="/problem/">1</a>
            <a name="page_turning" id="page_145" href="/problem/145/">145</a>
            """;

    private static final String DETAIL = """
            <html><head><title>1. A + B - AcWing题库</title></head>
            <div class="main-martor main-martor-content" data-field-name="content">
              <div class="martor-preview">
                <p>输入两个整数$A, B$</p>
                <h4>输入样例</h4><pre><code>3 4
            </code></pre>
              </div>
            </div>
            <td>难度：<span class="label label-success round">简单</span></td>
            <td>时/空限制：<span style="float:right;">1s / 64MB</span></td>
            </html>
            """;

    @Test
    void listStripsHighlightTagsAndCountsPages() {
        JsonNode out = service.normalizeList(1, LIST);

        assertThat(out.path("total").asInt()).isEqualTo(145 * 50);
        JsonNode first = out.path("problems").get(0);
        assertThat(first.path("platformId").asText()).isEqualTo("1");
        assertThat(first.path("topics")).extracting(JsonNode::asText).containsExactly("模拟", "数学");
    }

    @Test
    void detailReturnsStatementWithTemplates() {
        JsonNode out = service.normalizeDetail("1", DETAIL);

        assertThat(out.path("title").asText()).isEqualTo("A + B");
        assertThat(out.path("difficulty").asText()).isEqualTo("EASY");
        assertThat(out.path("contentHtml").asText()).contains("输入样例").contains("1s / 64MB");
        assertThat(out.path("sampleTestCases").asText()).isEqualTo("3 4\n");
        assertThat(out.path("codeSnippets")).hasSize(6);
    }

    @Test
    void rejectsLoginOrErrorPagesWithoutAStatement() {
        assertThatThrownBy(() -> service.normalizeDetail("1", "<title>登录</title>"))
                .isInstanceOf(ProblemStatementUnavailableException.class);
    }
}
