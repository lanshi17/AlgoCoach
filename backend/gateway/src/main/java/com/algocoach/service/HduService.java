package com.algocoach.service;

import com.algocoach.client.HduClient;
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
 * HDU (Hangzhou Dianzi University) problemset.
 *
 * <p>The list page renders its rows with a JavaScript helper, so the embedded
 * {@code p(color,pid,solved,title,ac,sub)} calls are parsed directly. Problem
 * pages are GB18030 HTML with fixed panels (Description/Input/Output/Sample);
 * HDU has no tags or difficulty, so {@code topics} is empty and difficulty is
 * neutral. Every problem ships a per-language starter template.</p>
 */
@Service
public class HduService {

    static final String PLATFORM = "HDU";
    static final int PAGE_SIZE = 100;

    private static final Pattern CALL = Pattern.compile(
            "p\\((\\d+),(\\d+),(-?\\d+),\"((?:[^\"\\\\]|\\\\.)*)\",(\\d+),(\\d+)\\)");
    private static final Pattern VOLUME_LINK = Pattern.compile("listproblem\\.php\\?vol=(\\d+)");
    private static final Pattern TITLE = Pattern.compile("<h1[^>]*>([\\s\\S]*?)</h1>");
    private static final Pattern PANEL = Pattern.compile(
            "<div class=panel_title align=left>(.*?)</div>\\s*<div class=panel_content>(.*?)</div>"
                    + "\\s*(?=<div class=panel_bottom)",
            Pattern.DOTALL);
    private static final Pattern TIME_LIMIT = Pattern.compile("Time Limit:\\s*(\\d+)");
    private static final Pattern MEMORY_LIMIT = Pattern.compile("Memory Limit:\\s*(\\d+)");
    private static final Pattern TAG_STRIP = Pattern.compile("<[^>]+>");

    private final HduClient client;
    private final ObjectMapper mapper;

    public HduService(HduClient client, ObjectMapper mapper) {
        this.client = client;
        this.mapper = mapper;
    }

    public Mono<JsonNode> list(int volume) {
        int page = Math.max(volume, 1);
        return client.get("/listproblem.php?vol=" + page).map(html -> normalizeList(page, html));
    }

    public Mono<JsonNode> detail(String problemId) {
        return client.get("/showproblem.php?pid=" + problemId)
                .map(html -> normalizeDetail(problemId, html));
    }

    JsonNode normalizeList(int volume, String html) {
        int maxVolume = volume;
        Matcher volumes = VOLUME_LINK.matcher(html);
        while (volumes.find()) {
            maxVolume = Math.max(maxVolume, Integer.parseInt(volumes.group(1)));
        }

        ArrayNode items = mapper.createArrayNode();
        Matcher calls = CALL.matcher(html);
        while (calls.find()) {
            String id = calls.group(2);
            ObjectNode item = mapper.createObjectNode();
            item.put("platform", PLATFORM);
            item.put("platformId", id);
            item.put("title", unescape(calls.group(4)));
            item.put("difficulty", "MEDIUM");
            item.put("url", "https://acm.hdu.edu.cn/showproblem.php?pid=" + id);
            item.set("topics", mapper.createArrayNode());
            items.add(item);
        }

        ObjectNode body = mapper.createObjectNode();
        body.put("platform", PLATFORM);
        body.put("page", volume);
        body.put("pageSize", PAGE_SIZE);
        body.put("total", maxVolume * PAGE_SIZE);
        body.set("problems", items);
        return body;
    }

    JsonNode normalizeDetail(String problemId, String html) {
        Matcher titleMatch = TITLE.matcher(html);
        String title = titleMatch.find() ? unescape(stripTags(titleMatch.group(1)).strip()) : problemId;

        StringBuilder content = new StringBuilder();
        String sampleInput = "";
        boolean hasDescription = false;
        Matcher panels = PANEL.matcher(html);
        while (panels.find()) {
            String section = panels.group(1).strip();
            String body = panels.group(2).strip();
            if (section.startsWith("Problem Description") && !stripTags(body).isBlank()) {
                hasDescription = true;
            }
            if (section.startsWith("Sample Input")) {
                if (sampleInput.isEmpty()) {
                    sampleInput = unescape(stripTags(body)).strip();
                }
                content.append("<h4>").append(section).append("</h4>").append(body);
            } else if (section.startsWith("Sample Output")
                    || section.startsWith("Problem Description")
                    || section.equals("Input")
                    || section.equals("Output")) {
                content.append("<h4>").append(section).append("</h4><div>").append(body).append("</div>");
            }
        }

        if (!hasDescription) {
            throw new ProblemStatementUnavailableException();
        }

        Matcher time = TIME_LIMIT.matcher(html);
        Matcher memory = MEMORY_LIMIT.matcher(html);
        StringBuilder limits = new StringBuilder();
        if (time.find()) {
            limits.append(time.group(1)).append(" ms");
        }
        if (memory.find()) {
            if (limits.length() > 0) {
                limits.append(" · ");
            }
            limits.append(Math.round(Integer.parseInt(memory.group(1)) / 1024.0)).append(" MB");
        }
        if (limits.length() > 0) {
            content.append("<p>限制：").append(limits).append("</p>");
        }

        ObjectNode out = mapper.createObjectNode();
        out.put("id", problemId);
        out.put("platform", PLATFORM);
        out.put("platformId", problemId);
        out.put("title", title);
        out.put("difficulty", "MEDIUM");
        out.put("contentHtml", content.toString());
        out.put("sampleTestCases", sampleInput);
        out.put("url", "https://acm.hdu.edu.cn/showproblem.php?pid=" + problemId);
        out.set("topics", mapper.createArrayNode());
        out.set("codeSnippets", CodeTemplates.snippets(mapper));
        return out;
    }

    private static String stripTags(String value) {
        return TAG_STRIP.matcher(value).replaceAll(" ");
    }

    private static String unescape(String value) {
        return value.replace("&nbsp;", " ").replace("&amp;", "&")
                .replace("&lt;", "<").replace("&gt;", ">")
                .replace("&quot;", "\"").replace("&#39;", "'");
    }
}
