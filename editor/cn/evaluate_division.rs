/*
 * @lc app=leetcode.cn id=399 lang=rust
 * @lcpr version=30305
 *
 * [399] 除法求值
 */

// @lc code=start
use std::collections::{HashMap, VecDeque};
impl Solution {
    pub fn calc_equation(
        equations: Vec<Vec<String>>,
        values: Vec<f64>,
        queries: Vec<Vec<String>>,
    ) -> Vec<f64> {
        let mut graph: HashMap<String, Vec<(String, f64)>> = HashMap::new();
        for (i, equation) in equations.iter().enumerate() {
            let a = &equation[0];
            let b = &equation[1];
            let w = values[i];
            graph.entry(a.clone()).or_default().push((b.clone(), w));
            graph
                .entry(b.clone())
                .or_default()
                .push((a.clone(), 1.0 / w));
        }
        let mut res = Vec::with_capacity(queries.len());
        for query in queries {
            let start = &query[0];
            let end = &query[1];
            // BFS 遍历图，计算 start 到 end 的路径乘积
            let result = Self::bfs(&graph, start, end);
            res.push(result);
        }
        res
    }
    fn bfs(graph: &HashMap<String, Vec<(String, f64)>>, start: &str, end: &str) -> f64 {
        // 如果起始或结束节点不存在于图中，肯定无法到达
        if !graph.contains_key(start) || !graph.contains_key(end) {
            return -1.0;
        }

        // 如果起始和结束节点相同，结果为 1.0
        if start == end {
            return 1.0;
        }

        // BFS 标准框架
        let mut queue: VecDeque<String> = VecDeque::new();
        let mut visited: std::collections::HashSet<String> = std::collections::HashSet::new();
        queue.push_back(start.to_string());
        visited.insert(start.to_string());

        // 记录从 start 到该节点的路径乘积
        let mut path_weights: HashMap<String, f64> = HashMap::new();
        path_weights.insert(start.to_string(), 1.0);

        while let Some(current_node) = queue.pop_front() {
            if let Some(neighbors) = graph.get(&current_node) {
                for (neighbor_node, edge_weight) in neighbors {
                    if visited.contains(neighbor_node) {
                        continue;
                    }

                    // 更新路径乘积
                    let new_weight = path_weights[&current_node] * edge_weight;
                    path_weights.insert(neighbor_node.clone(), new_weight);

                    if neighbor_node == end {
                        return new_weight;
                    }

                    // 记录 visited
                    visited.insert(neighbor_node.clone());
                    // 新节点加入队列继续遍历
                    queue.push_back(neighbor_node.clone());
                }
            }
        }

        // 队列为空仍未找到目标节点，说明无法到达
        -1.0
    }
}
// @lc code=end

/*
// @lcpr case=start
// [["a","b"],["b","c"]]\n[2.0,3.0]\n[["a","c"],["b","a"],["a","e"],["a","a"],["x","x"]]\n
// @lcpr case=end

// @lcpr case=start
// [["a","b"],["b","c"],["bc","cd"]]\n[1.5,2.5,5.0]\n[["a","c"],["c","b"],["bc","cd"],["cd","bc"]]\n
// @lcpr case=end

// @lcpr case=start
// [["a","b"]]\n[0.5]\n[["a","b"],["b","a"],["a","c"],["x","y"]]\n
// @lcpr case=end

 */
