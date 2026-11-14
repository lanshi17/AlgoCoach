package com.algocoach.dto;

import java.util.List;

/** Submission facts forwarded from the gateway to the local agent memory service. */
public record MemoryRecordRequest(
        String problem_id,
        String platform,
        String status,
        String lang,
        int duration_sec,
        List<String> topics
) {
}
