package com.algocoach.service;

import com.algocoach.client.AcWingClient;
import com.algocoach.exception.ProblemStatementUnavailableException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * AcWing problemset (list + detail) through the stored session cookie.
 *
 * <p>AcWing renders its problem list server-side as a table and its statement
 * page as HTML; the gateway parses both into the same Problem shape the
 * LeetCode endpoints use. 专项 filtering reuses the site's tag search
 * ({@code /problem/search/{page}/?search_content=<tag>}).</p>
 */
@Service
public class AcWingService {

    static final String PLATFORM = "ACWING";
    static final int PAGE_SIZE = 50;

    private static final Pattern ROW = Pattern.compile("<tr>([\\s\\S]*?)</tr>");
    private static final Pattern PROBLEM_ID = Pattern.compile("problem-title-(\\d+)");
    private static final Pattern DIFFICULTY = Pattern.compile(
            "label label-(?:success|warning|danger) round[^>]*>\\s*(简单|中等|困难)");
    private static final Pattern PAGE_LINK = Pattern.compile("name=\"page_turning\" id=\"page_(\\d+)\"");
    private static final Pattern CONTENT_TITLE = Pattern.compile("<title>(.*?)</title>", Pattern.DOTALL);
    private static final Pattern LIMITS = Pattern.compile("时/空限制：\\s*<span[^>]*>([^<]+)</span>");
    private static final Pattern SAMPLE_INPUT = Pattern.compile(
            "<h4>\\s*输入样例\\s*\\d*\\s*</h4>\\s*<pre><code>([\\s\\S]*?)</code></pre>");
    private static final Pattern TAG_STRIP = Pattern.compile("<[^>]+>");

    private final AcWingClient client;
    private final ObjectMapper mapper;

    public AcWingService(AcWingClient client, ObjectMapper mapper) {
        this.client = client;
        this.mapper = mapper;
    }

    public Mono<JsonNode> list(int page, String tag) {
        int pageNumber = Math.max(page, 1);
        String path;
        if (tag == null || tag.isBlank()) {
            path = pageNumber == 1 ? "/problem/" : "/problem/" + pageNumber + "/";
        } else {
            path = "/problem/search/" + pageNumber + "/?search_content=" + tag.strip();
        }
        return client.get(path).map(html -> normalizeList(pageNumber, html));
    }

    public Mono<JsonNode> detail(String problemId) {
        return client.get("/problem/content/" + problemId + "/")
                .map(html -> normalizeDetail(problemId, html));
    }

    JsonNode normalizeList(int page, String html) {
        int totalPages = 1;
        Matcher pages = PAGE_LINK.matcher(html);
        while (pages.find()) {
            totalPages = Math.max(totalPages, Integer.parseInt(pages.group(1)));
        }

        ArrayNode items = mapper.createArrayNode();
        Matcher rows = ROW.matcher(html);
        while (rows.find()) {
            String row = rows.group(1);
            Matcher idMatch = PROBLEM_ID.matcher(row);
            if (!idMatch.find()) {
                continue;
            }
            String id = idMatch.group(1);
            ObjectNode item = mapper.createObjectNode();
            item.put("platform", PLATFORM);
            item.put("platformId", id);
            item.put("title", titleOf(row, id));
            item.put("difficulty", difficultyOf(row));
            item.put("url", "https://www.acwing.com/problem/content/" + id + "/");
            item.set("topics", keywordsOf(row, "problem-keywords-", id));
            items.add(item);
        }

        ObjectNode body = mapper.createObjectNode();
        body.put("platform", PLATFORM);
        body.put("page", page);
        body.put("pageSize", PAGE_SIZE);
        body.put("total", totalPages * PAGE_SIZE);
        body.set("problems", items);
        return body;
    }

    JsonNode normalizeDetail(String problemId, String html) {
        Matcher titleMatch = CONTENT_TITLE.matcher(html);
        String title = titleMatch.find() ? titleMatch.group(1).strip() : problemId;
        title = title.replaceFirst("^\\d+\\.\\s*", "").replaceFirst("\\s+-\\s+AcWing题库$", "");

        String statement = contentBlock(html);
        if (statement.isBlank() || stripTags(statement).isBlank()) {
            throw new ProblemStatementUnavailableException();
        }
        String sampleInput = "";
        Matcher sample = SAMPLE_INPUT.matcher(statement);
        if (sample.find()) {
            sampleInput = unescape(sample.group(1));
        }

        String contentHtml = statement;
        Matcher limits = LIMITS.matcher(html);
        if (limits.find()) {
            contentHtml = contentHtml + "<p>限制：" + limits.group(1).strip() + "</p>";
        }

        ObjectNode out = mapper.createObjectNode();
        out.put("id", problemId);
        out.put("platform", PLATFORM);
        out.put("platformId", problemId);
        out.put("title", title);
        out.put("difficulty", difficultyOf(html));
        out.put("contentHtml", contentHtml);
        out.put("sampleTestCases", sampleInput);
        out.put("url", "https://www.acwing.com/problem/content/" + problemId + "/");
        out.set("topics", mapper.createArrayNode());
        out.set("codeSnippets", CodeTemplates.snippets(mapper));
        return out;
    }

    private static String titleOf(String row, String id) {
        Matcher title = Pattern.compile("problem-title-" + id + "\"[^>]*>([\\s\\S]*?)</a>").matcher(row);
        return title.find() ? unescape(stripTags(title.group(1)).strip()) : id;
    }

    static String difficultyOf(String html) {
        Matcher match = DIFFICULTY.matcher(html);
        if (!match.find()) {
            return "MEDIUM";
        }
        return switch (match.group(1)) {
            case "简单" -> "EASY";
            case "困难" -> "HARD";
            default -> "MEDIUM";
        };
    }

    private ArrayNode keywordsOf(String row, String prefix, String id) {
        ArrayNode values = mapper.createArrayNode();
        Matcher block = Pattern.compile(prefix + id + "\"[\\s\\S]*?let keywords = \"(.*?)\"").matcher(row);
        if (block.find()) {
            for (String part : block.group(1).split(",")) {
                String value = stripTags(part).strip();
                if (!value.isEmpty()) {
                    values.add(value);
                }
            }
        }
        return values;
    }

    /** Extract the outer HTML of {@code div[data-field-name="content"]}. */
    static String contentBlock(String html) {
        int marker = html.indexOf("data-field-name=\"content\"");
        if (marker < 0) {
            return "";
        }
        int start = html.lastIndexOf("<div", marker);
        int depth = 0;
        Matcher tags = Pattern.compile("<div\\b|</div>").matcher(html.substring(start));
        while (tags.find()) {
            depth += tags.group().startsWith("</") ? -1 : 1;
            if (depth == 0) {
                return html.substring(start, start + tags.end());
            }
        }
        return "";
    }

    static String stripTags(String value) {
        return TAG_STRIP.matcher(value).replaceAll(" ");
    }

    private static String unescape(String value) {
        return value.replace("&nbsp;", " ").replace("&amp;", "&")
                .replace("&lt;", "<").replace("&gt;", ">")
                .replace("&quot;", "\"").replace("&#39;", "'");
    }
}
