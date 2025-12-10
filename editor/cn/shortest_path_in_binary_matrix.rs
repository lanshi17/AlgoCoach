/*
 * @lc app=leetcode.cn id=1091 lang=rust
 * @lcpr version=30304
 *
 * [1091] 二进制矩阵中的最短路径
 */

// @lc code=start
use std::collections::VecDeque;

const DIRS: [(i32, i32); 8] =
    [(0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)];

impl Solution {
    /// 在一个 N × N 的方形网格中，找到从左上角 (0, 0) 到右下角 (N-1, N-1) 的最短畅通路径。
    /// 路径上的所有单元格的值都必须是 0。
    ///
    /// # Arguments
    /// * `grid`: Vec<Vec<i32>> - 一个由 0 和 1 组成的二维网格。
    ///
    /// # Returns
    /// * `i32` - 最短路径的长度。如果不存在这样的路径，则返回 -1。
    pub fn shortest_path_binary_matrix(grid: Vec<Vec<i32>>) -> i32 {
        let rows = grid.len();
        let cols = grid[0].len();

        // 1. 检查基本的不可达条件
        if grid[0][0] == 1 || grid[rows - 1][cols - 1] == 1 {
            return -1;
        }
        if rows == 1 && cols == 1 {
            return 1;
        }

        // 2. 初始化 BFS
        let mut queue: VecDeque<(usize, usize)> = VecDeque::new();
        let mut visited: Vec<Vec<bool>> = vec![vec![false; cols]; rows];

        queue.push_back((0, 0));
        visited[0][0] = true;

        let mut steps = 1; // 起点算作第一步

        // 3. BFS 主循环
        while !queue.is_empty() {
            let level_size = queue.len(); // 当前层级的节点数

            // 4. 遍历当前层级的所有节点
            for _ in 0..level_size {
                if let Some((row, col)) = queue.pop_front() {
                    // 5. 探索 8 个方向的邻居
                    for &(dr, dc) in &DIRS {
                        let new_row = row as i32 + dr;
                        let new_col = col as i32 + dc;

                        // 6. 检查邻居是否在网格范围内
                        if new_row >= 0
                            && new_row < rows as i32
                            && new_col >= 0
                            && new_col < cols as i32
                        {
                            let nr = new_row as usize;
                            let nc = new_col as usize;

                            // 7. 检查邻居是否是未访问的空地 (0)
                            if !visited[nr][nc] && grid[nr][nc] == 0 {
                                // 8. 检查是否到达终点
                                if nr == rows - 1 && nc == cols - 1 {
                                    return steps + 1;
                                }

                                // 9. 将有效的邻居标记为已访问并加入队列
                                visited[nr][nc] = true;
                                queue.push_back((nr, nc));
                            }
                        }
                    }
                }
            }
            // 10. 当前层级遍历完成，步数增加
            steps += 1;
        }

        // 11. 如果队列为空仍未找到路径，则返回 -1
        -1
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[0,1],[1,0]]\n
// @lcpr case=end

// @lcpr case=start
// [[0,0,0],[1,1,0],[1,1,0]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,0,0],[1,1,0],[1,1,0]]\n
// @lcpr case=end

 */
