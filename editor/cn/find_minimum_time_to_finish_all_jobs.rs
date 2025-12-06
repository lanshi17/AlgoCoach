/*
 * @lc app=leetcode.cn id=1723 lang=rust
 * @lcpr version=30304
 *
 * [1723] 完成所有工作的最短时间
 */

// @lc code=start
impl Solution {
    pub fn minimum_time_required(jobs: Vec<i32>, k: i32) -> i32 {
        let k = k as usize;
        let mut jobs = jobs.clone();
        jobs.sort_unstable_by(|a, b| b.cmp(a));
        let left = *jobs.iter().max().unwrap_or(&0);
        let right = jobs.iter().sum::<i32>();
        Self::binary_search(&jobs, k, left, right)
    }
    fn binary_search(jobs: &[i32], k: usize, mut left: i32, mut right: i32) -> i32 {
        while left < right {
            let mid = left + (right - left) / 2;
            if Self::can_finish(jobs, k, mid, 0, &mut vec![0; k]) {
                right = mid;
            } else {
                left = mid + 1;
            }
        }
        left
    }
    fn can_finish(
        jobs: &[i32],
        k: usize,
        limit: i32,
        job_idx: usize,
        workloads: &mut [i32],
    ) -> bool {
        if job_idx == jobs.len() {
            return true;
        }
        let current_job = jobs[job_idx];
        let mut chosen_loads = std::collections::HashSet::new();
        for worker_idx in 0..k {
            let new_load = workloads[worker_idx] + current_job;
            if new_load > limit {
                continue;
            }
            if !chosen_loads.insert(workloads[worker_idx]) {
                continue;
            }
            workloads[worker_idx] = new_load;
            if Self::can_finish(jobs, k, limit, job_idx + 1, workloads) {
                return true;
            }
            workloads[worker_idx] -= current_job;
            if workloads[worker_idx] == 0 {
                break;
            }
        }
        false
    }
}
// @lc code=end

/*
// @lcpr case=start
// [3,2,3]\n3\n
// @lcpr case=end

// @lcpr case=start
// [1,2,4,7,8]\n2\n
// @lcpr case=end

 */
