/*
 * @lc app=leetcode.cn id=2101 lang=rust
 * @lcpr version=30304
 *
 * [2101] 引爆最多的炸弹
 */

// @lc code=start
use std::collections::VecDeque;
impl Solution {
    /// 给定一个炸弹数组，每个炸弹由 [x, y, r] 表示（圆心坐标和爆炸半径），
    /// 当一个炸弹被引爆时，所有在其爆炸范围内的炸弹也会被引爆，连锁反应。
    /// 返回通过选择最优的初始引爆炸弹，最多能引爆多少个炸弹。
    ///
    /// # Arguments
    /// * `bombs` - 一个二维向量，其中 `bombs[i] = [x, y, r]` 代表第 i 个炸弹的位置和半径。
    ///
    /// # Returns
    /// * `i32` - 最多能引爆的炸弹数量。
    pub fn maximum_detonation(bombs: Vec<Vec<i32>>) -> i32 {
        let n = bombs.len();

        // 1. 构建有向图的邻接表
        // graph[i] 包含所有会被炸弹 i 直接引爆的炸弹的索引
        let mut graph: Vec<Vec<usize>> = vec![vec![]; n];

        for i in 0..n {
            // 将 i32 转换为 i64 以避免计算距离时可能发生的溢出
            let x1 = bombs[i][0] as i64;
            let y1 = bombs[i][1] as i64;
            let r1 = bombs[i][2] as i64;

            for j in 0..n {
                if i == j {
                    continue;
                }

                let x2 = bombs[j][0] as i64;
                let y2 = bombs[j][1] as i64;

                // 计算两个炸弹中心之间的平方距离
                let dx = x1 - x2;
                let dy = y1 - y2;
                let distance_squared = dx * dx + dy * dy;

                // 如果炸弹 j 在炸弹 i 的爆炸范围内，则建立一条从 i 到 j 的有向边
                if distance_squared <= r1 * r1 {
                    graph[i].push(j);
                }
            }
        }

        // 2. 对每个炸弹作为起点进行 BFS，找出能引爆的最大数量
        let mut max_detonated = 0;
        for i in 0..n {
            let detonated_count = Self::bfs(&graph, i, n);
            max_detonated = max_detonated.max(detonated_count);
        }

        max_detonated
    }
    /// 使用广度优先搜索 (BFS) 计算从给定起始节点出发可以到达的节点总数。
    ///
    /// # Arguments
    /// * `graph` - 图的邻接表表示。
    /// * `start` - BFS 遍历的起始节点索引。
    /// * `size` - 图中节点的总数。
    ///
    /// # Returns
    /// * `i32` - 从 `start` 节点出发可以访问到的节点数量。
    fn bfs(graph: &[Vec<usize>], start: usize, size: usize) -> i32 {
        let mut visited = vec![false; size];
        let mut queue: VecDeque<usize> = VecDeque::new();
        let mut count = 0;

        queue.push_back(start);
        visited[start] = true;

        while let Some(current_node) = queue.pop_front() {
            count += 1;

            // 遍历当前节点的所有邻居
            for &neighbor in &graph[current_node] {
                // 如果邻居节点尚未被访问，则将其加入队列
                if !visited[neighbor] {
                    visited[neighbor] = true;
                    queue.push_back(neighbor);
                }
            }
        }

        count
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[2,1,3],[6,1,4]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,1,5],[10,10,5]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,2,3],[2,3,1],[3,4,2],[4,5,3],[5,6,4]]\n
// @lcpr case=end

 */
