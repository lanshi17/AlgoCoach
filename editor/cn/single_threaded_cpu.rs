/*
 * @lc app=leetcode.cn id=1834 lang=rust
 * @lcpr version=30300
 *
 * [1834] 单线程 CPU
 */

// @lc code=start
use std::cmp::Reverse;
use std::collections::BinaryHeap;
impl Solution {
    pub fn get_order(tasks: Vec<Vec<i32>>) -> Vec<i32> {
        let n = tasks.len();
        let mut sorted_tasks: Vec<[i32; 3]> = tasks
            .iter()
            .enumerate()
            .map(|(idx, task)| [task[0], task[1], idx as i32])
            .collect();
        sorted_tasks.sort_unstable_by_key(|task| task[0]);
        let mut min_heap: BinaryHeap<Reverse<(i32, i32)>> = BinaryHeap::new();
        let mut res = Vec::with_capacity(n);
        let mut current_time: i64 = 0;
        let mut task_idx = 0;
        while res.len() < n {
            while task_idx < n && sorted_tasks[task_idx][0] as i64 <= current_time {
                let task = sorted_tasks[task_idx];
                min_heap.push(Reverse((task[1], task[2])));
                task_idx += 1;
            }
            if let Some(Reverse((process_time, idx))) = min_heap.pop() {
                res.push(idx);
                current_time += process_time as i64;
            } else {
                if task_idx < n {
                    current_time = sorted_tasks[task_idx][0] as i64;
                }
            }
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[1,2],[2,4],[3,2],[4,1]]\n
// @lcpr case=end

// @lcpr case=start
// [[7,10],[7,12],[7,5],[7,4],[7,2]]\n
// @lcpr case=end

 */
