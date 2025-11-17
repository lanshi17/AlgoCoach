/*
 * @lc app=leetcode.cn id=1368 lang=rust
 * @lcpr version=30304
 *
 * [1368] 使网格图至少有一条有效路径的最小代价
 */

// @lc code=start
use std::cmp::Reverse;
use std::collections::{BinaryHeap, VecDeque};

impl Solution {
    pub fn min_cost(grid: Vec<Vec<i32>>) -> i32 {
        let m = grid.len();
        let n = grid[0].len();

        // 方向数组：右、左、下、上（对应数字1、2、3、4）
        let directions = [(0, 1), (0, -1), (1, 0), (-1, 0)];

        // 使用双端队列进行0-1 BFS
        let mut deque = VecDeque::new();
        let mut dist = vec![vec![i32::MAX; n]; m];

        // 初始化起点
        deque.push_back((0, 0, 0)); // (cost, row, col)
        dist[0][0] = 0;

        while let Some((cost, x, y)) = deque.pop_front() {
            // 如果已经找到了更优的路径，跳过
            if cost > dist[x][y] {
                continue;
            }

            // 如果到达终点
            if x == m - 1 && y == n - 1 {
                return cost;
            }

            // 尝试四个方向
            for (dir_idx, (dx, dy)) in directions.iter().enumerate() {
                let nx = x as i32 + dx;
                let ny = y as i32 + dy;

                // 检查边界
                if nx >= 0 && nx < m as i32 && ny >= 0 && ny < n as i32 {
                    let nx = nx as usize;
                    let ny = ny as usize;

                    // 计算移动代价
                    // 如果当前格子的方向就是我们要走的方向，代价为0，否则为1
                    let move_cost = if (dir_idx + 1) as i32 == grid[x][y] {
                        0
                    } else {
                        1
                    };
                    let new_cost = cost + move_cost;

                    // 如果找到了更优的路径
                    if new_cost < dist[nx][ny] {
                        dist[nx][ny] = new_cost;

                        // 0-1 BFS: 代价为0的边放到队首，代价为1的边放到队尾
                        if move_cost == 0 {
                            deque.push_front((new_cost, nx, ny));
                        } else {
                            deque.push_back((new_cost, nx, ny));
                        }
                    }
                }
            }
        }

        dist[m - 1][n - 1]
    }
}

// @lc code=end

/*
// @lcpr case=start
// [[1,1,1,1],[2,2,2,2],[1,1,1,1],[2,2,2,2]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,1,3],[3,2,2],[1,1,4]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,2],[4,3]]\n
// @lcpr case=end

 */
