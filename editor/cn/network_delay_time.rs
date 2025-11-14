/*
 * @lc app=leetcode.cn id=743 lang=rust
 * @lcpr version=30304
 *
 * [743] 网络延迟时间
 */

// @lc code=start
use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap};

struct Graph {
    adjacency_list: HashMap<usize, Vec<(usize, i32)>>,
}

impl Graph {
    // 创建新的空图
    fn new() -> Self {
        Graph {
            adjacency_list: HashMap::new(),
        }
    }

    // 添加边 (from -> to，权重为weight)
    fn add_edge(&mut self, from: usize, to: usize, weight: i32) {
        self.adjacency_list
            .entry(from)
            .or_insert_with(Vec::new)
            .push((to, weight));
    }
}

// Dijkstra算法实现 - 寻找从起始节点到所有节点的最短路径
fn dijkstra(graph: &Graph, start: usize) -> HashMap<usize, i32> {
    let mut heap = BinaryHeap::new();
    let mut distances = HashMap::new();
    let mut visited = HashMap::new();

    // 初始化起始节点
    distances.insert(start, 0);
    heap.push(Reverse((0, start)));

    while let Some(Reverse((current_dist, current_node))) = heap.pop() {
        // 如果已访问过，跳过
        if visited.contains_key(&current_node) {
            continue;
        }

        // 标记为已访问
        visited.insert(current_node, true);

        // 更新邻居节点的距离
        if let Some(neighbors) = graph.adjacency_list.get(&current_node) {
            for &(neighbor, weight) in neighbors {
                let new_distance = current_dist + weight;

                // 如果找到了更短的路径
                if new_distance < *distances.get(&neighbor).unwrap_or(&i32::MAX) {
                    distances.insert(neighbor, new_distance);
                    heap.push(Reverse((new_distance, neighbor)));
                }
            }
        }
    }

    distances
}

// 网络延迟时间问题的解决方案
impl Solution {
    pub fn network_delay_time(times: Vec<Vec<i32>>, n: i32, k: i32) -> i32 {
        // 构建图
        let mut graph = Graph::new();
        for time in &times {
            graph.add_edge(time[0] as usize, time[1] as usize, time[2]);
        }

        // 使用Dijkstra算法计算从节点k到所有节点的最短路径
        let distances = dijkstra(&graph, k as usize);

        // 如果不能到达所有节点，返回-1
        if distances.len() != n as usize {
            return -1;
        }

        // 返回最大的最短路径（即网络延迟时间）
        *distances.values().max().unwrap_or(&0)
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[2,1,1],[2,3,1],[3,4,1]]\n4\n2\n
// @lcpr case=end

// @lcpr case=start
// [[1,2,1]]\n2\n1\n
// @lcpr case=end

// @lcpr case=start
// [[1,2,1]]\n2\n2\n
// @lcpr case=end

 */
