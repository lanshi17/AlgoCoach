/*
 * @lc app=leetcode.cn id=LCR 106 lang=rust
 * @lcpr version=30302
 *
 * [LCR 106] 判断二分图
 */

// @lc code=start
use std::collections::VecDeque;
impl Solution {
    pub fn is_bipartite(graph: Vec<Vec<i32>>) -> bool {
        let mut color = vec![None; graph.len()];
        for i in 0..graph.len() {
            if color[i].is_some() {
                continue;
            }
            color[i] = Some(true);
            let mut deque = VecDeque::new();
            deque.push_back(i);
            while let Some(j) = deque.pop_front() {
                for k in graph[j].iter().map(|&z| z as usize) {
                    if color[k] == color[j] {
                        return false;
                    }
                    if color[k].is_none() {
                        color[k] = color[j].map(|b| !b);
                        deque.push_back(k);
                    }
                }
            }
        }
        true
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[1,2,3],[0,2],[0,1,3],[0,2]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,3],[0,2],[1,3],[0,2]]\n
// @lcpr case=end

 */
