package com.algocoach.repository;

import com.algocoach.model.SubmissionRecord;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Thin persistence layer for {@link SubmissionRecord}.
 *
 * <p>History reads are always newest first; callers pass {@code problemId} to narrow
 * the result to one LeetCode question. The {@link Pageable} variants translate the
 * caller's limit into SQL, so the database returns only the requested rows.</p>
 */
public interface SubmissionRepository extends JpaRepository<SubmissionRecord, String> {

    /** All submissions, newest first. */
    List<SubmissionRecord> findAllByOrderByCreatedAtDesc();

    /** All submissions, newest first, limited by the {@link Pageable}. */
    List<SubmissionRecord> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /** Submissions for one LeetCode question, newest first. */
    List<SubmissionRecord> findByProblemIdOrderByCreatedAtDesc(String problemId);

    /** Submissions for one question, newest first, limited by the {@link Pageable}. */
    List<SubmissionRecord> findByProblemIdOrderByCreatedAtDesc(String problemId, Pageable pageable);
}
