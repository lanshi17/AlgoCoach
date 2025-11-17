/*
 * @lc app=leetcode.cn id=1514 lang=rust
 * @lcpr version=30304
 *
 * [1514] 概率最大的路径
 */

// @lc code=start
use std::collections::BinaryHeap;
// 状态结构体
#[derive(Debug, Clone, Copy, PartialEq)]
struct State {
    node: usize,
    prob_from_start: f64,
}

// 为State实现Eq和PartialEq以便比较
impl Eq for State {}

// 实现Ord和PartialOrd以在BinaryHeap中正确排序
// 求最大概率路径，所以需要把概率大的放在前面
impl PartialOrd for State {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        self.prob_from_start.partial_cmp(&other.prob_from_start)
    }
}

impl Ord for State {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.prob_from_start
            .partial_cmp(&other.prob_from_start)
            .unwrap_or(std::cmp::Ordering::Equal)
    }
}
impl Solution {
    pub fn max_probability(
        n: i32,
        edges: Vec<Vec<i32>>,
        succ_prob: Vec<f64>,
        start: i32,
        end: i32,
    ) -> f64 {
        let n = n as usize;
        let start = start as usize;
        let end = end as usize;

        // 构造无向图
        let mut graph: Vec<Vec<(usize, f64)>> = vec![vec![]; n];
        for i in 0..edges.len() {
            let from = edges[i][0] as usize;
            let to = edges[i][1] as usize;
            let weight = succ_prob[i];
            // 无向图其实就是双向图
            graph[from].push((to, weight));
            graph[to].push((from, weight));
        }

        let res = Self::dijkstra(&graph, start, end);
        // 如果 res 为 -1，说明没有从 start 到 end 的路径
        if res == -1.0 {
            0.0
        } else {
            res
        }
    }

    // Dijkstra 算法模板
    fn dijkstra(graph: &Vec<Vec<(usize, f64)>>, src: usize, dst: usize) -> f64 {
        let n = graph.len();
        let mut prob_to = vec![-1.0; n];

        let mut pq = BinaryHeap::new();
        pq.push(State {
            node: src,
            prob_from_start: 1.0,
        });

        while let Some(state) = pq.pop() {
            let cur_node = state.node;
            let cur_prob_from_start = state.prob_from_start;

            if prob_to[cur_node] != -1.0 {
                continue;
            }

            // curNode 节点第一次出队时，就找到了从 src 到 curNode 的最大概率路径
            prob_to[cur_node] = cur_prob_from_start;

            // 如果 curNode 是终点 dst，直接返回最大概率路径
            if cur_node == dst {
                return cur_prob_from_start;
            }

            for &(next_node, weight) in &graph[cur_node] {
                let next_prob_from_start = cur_prob_from_start * weight;

                if prob_to[next_node] != -1.0 {
                    continue;
                }
                pq.push(State {
                    node: next_node,
                    prob_from_start: next_prob_from_start,
                });
            }
        }

        -1.0
    }
}
// @lc code=end

/*
// @lcpr case=start
// 3\n[[0,1],[1,2],[0,2]]\n[0.5,0.5,0.2]\n0\n2\n
// @lcpr case=end

// @lcpr case=start
// 3\n[[0,1],[1,2],[0,2]]\n[0.5,0.5,0.3]\n0\n2\n
// @lcpr case=end

// @lcpr case=start
// 3\n[[0,1]]\n[0.5]\n0\n2\n
// @lcpr case=end

 */
