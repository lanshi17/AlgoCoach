package com.algocoach.dto;

import java.util.List;

/** Submission facts forwarded from the gateway to the local agent memory service. */
public record MemoryRecordRequest(
        String problem_id,
        String platform,
        String status,
        String lang,
        int duration_sec,
        List<String> topics,
        String workspace_id
) {
    public MemoryRecordRequest(
            String problem_id,
            String platform,
            String status,
            String lang,
            int duration_sec,
            List<String> topics) {
        this(problem_id, platform, status, lang, duration_sec, topics, "local-default");
    }

    public MemoryRecordRequest {
        workspace_id = workspace_id == null || workspace_id.isBlank()
                ? "local-default" : workspace_id.trim();
    }
}
