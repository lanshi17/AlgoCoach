/*
 * @lc app=leetcode.cn id=310 lang=rust
 * @lcpr version=30304
 *
 * [310] 最小高度树
 */

// @lc code=start
use std::collections::VecDeque;
impl Solution {
    pub fn find_min_height_trees(n: i32, edges: Vec<Vec<i32>>) -> Vec<i32> {
        let n = n as usize;
        if n == 1 {
            return vec![0];
        }
        let mut graph: Vec<Vec<usize>> = vec![Vec::new(); n];
        let mut degree: Vec<i32> = vec![0; n];
        for edge in edges {
            let u = edge[0] as usize;
            let v = edge[1] as usize;
            graph[u].push(v);
            graph[v].push(u);
            degree[u] += 1;
            degree[v] += 1;
        }
        let mut queue: VecDeque<usize> = VecDeque::new();
        for i in 0..n {
            if degree[i] == 1 {
                queue.push_back(i);
            }
        }
        let mut remaining_nodes = n;
        while remaining_nodes > 2 {
            let leaves_count = queue.len();
            remaining_nodes -= leaves_count;
            for _ in 0..leaves_count {
                if let Some(leaf) = queue.pop_front() {
                    for &neighbor in &graph[leaf] {
                        degree[neighbor] -= 1;
                        if degree[neighbor] == 1 {
                            queue.push_back(neighbor);
                        }
                    }
                }
            }
        }
        queue.into_iter().map(|x| x as i32).collect()
    }
}
// @lc code=end

/*
// @lcpr case=start
// 4\n[[1,0],[1,2],[1,3]]\n
// @lcpr case=end

// @lcpr case=start
// 6\n[[3,0],[3,1],[3,2],[3,4],[5,4]]\n
// @lcpr case=end

 */
