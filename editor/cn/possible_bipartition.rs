/*
 * @lc app=leetcode.cn id=886 lang=rust
 * @lcpr version=30302
 *
 * [886] 可能的二分法
 */

// @lc code=start
use std::collections::VecDeque;
impl Solution {
    pub fn possible_bipartition(n: i32, dislikes: Vec<Vec<i32>>) -> bool {
        let mut graph = vec![Vec::new(); (n + 1) as usize];
        for dislike in &dislikes {
            let a = dislike[0] as usize;
            let b = dislike[1] as usize;
            graph[a].push(b);
            graph[b].push(a);
        }
        let mut personal_like = vec![None; (n + 1) as usize];
        for i in 1..=n as usize {
            if personal_like[i].is_some() {
                continue;
            }
            personal_like[i] = Some(true);
            let mut queue = VecDeque::new();
            queue.push_back(i);
            while let Some(j) = queue.pop_front() {
                for k in graph[j].iter().map(|&z| z as usize) {
                    if personal_like[k] == personal_like[j] {
                        return false;
                    }
                    if personal_like[k].is_none() {
                        personal_like[k] = personal_like[j].map(|x| !x);
                        queue.push_back(k);
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
// 4\n[[1,2],[1,3],[2,4]]\n
// @lcpr case=end

// @lcpr case=start
// 3\n[[1,2],[1,3],[2,3]]\n
// @lcpr case=end

 */
