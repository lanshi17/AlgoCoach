/*
 * @lc app=leetcode.cn id=994 lang=rust
 * @lcpr version=30304
 *
 * [994] 腐烂的橘子
 */

// @lc code=start
use std::collections::VecDeque;
const DIRS: [(i32, i32); 4] = [(-1, 0), (1, 0), (0, -1), (0, 1)];
impl Solution {
    /// 计算腐烂橘子感染所有新鲜橘子所需的最短时间
    ///
    /// # 参数
    /// * `grid` - 一个 m x n 的网格，其中:
    ///            - 0 代表空单元格
    ///            - 1 代表新鲜橘子
    ///            - 2 代表腐烂橘子
    ///
    /// # 返回值
    /// * `i32` - 所需的最小分钟数。如果无法全部感染，则返回 -1。
    pub fn oranges_rotting(grid: Vec<Vec<i32>>) -> i32 {
        // 1. 初始化变量
        let rows = grid.len();
        let cols = grid[0].len();
        let mut grid = grid; // 使其可变，以便更新橘子状态
        let mut queue: VecDeque<(usize, usize)> = VecDeque::new();
        let mut fresh_count = 0i32; // 统计新鲜橘子数量

        // 方向数组，用于计算上下左右的坐标
        const DIRS: [(i32, i32); 4] = [(-1, 0), (1, 0), (0, -1), (0, 1)];

        // 2. 遍历网格，初始化队列和新鲜橘子计数器
        for i in 0..rows {
            for j in 0..cols {
                if grid[i][j] == 2 {
                    queue.push_back((i, j));
                } else if grid[i][j] == 1 {
                    fresh_count += 1;
                }
            }
        }

        // 3. 特殊情况：一开始就没有新鲜橘子
        if fresh_count == 0 {
            return 0;
        }

        let mut minutes = 0;

        // 4. BFS 算法主循环
        while !queue.is_empty() {
            let level_size = queue.len();
            let mut has_rotten = false; // 标志位：本轮是否有新橘子被感染

            // 5. 遍历当前层级（即当前分钟）的所有腐烂橘子
            for _ in 0..level_size {
                // 从队列前端取出一个腐烂橘子的坐标
                if let Some((x, y)) = queue.pop_front() {
                    // 6. 向四个方向扩散
                    for &(dx, dy) in &DIRS {
                        let nx = x as i32 + dx;
                        let ny = y as i32 + dy;

                        // 7. 检查邻居是否在边界内且为新鲜橘子
                        if nx >= 0
                            && nx < rows as i32
                            && ny >= 0
                            && ny < cols as i32
                            && grid[nx as usize][ny as usize] == 1
                        {
                            let nx_usize = nx as usize;
                            let ny_usize = ny as usize;

                            // 8. 感染该橘子
                            grid[nx_usize][ny_usize] = 2;
                            fresh_count -= 1; // 新鲜橘子数量减一
                            queue.push_back((nx_usize, ny_usize)); // 将新腐烂的橘子加入队列
                            has_rotten = true; // 标记本轮发生了感染
                        }
                    }
                }
            }

            // 9. 如果本轮有感染发生，则时间增加一分钟
            if has_rotten {
                minutes += 1;
            }
        }

        // 10. 最终检查：是否所有新鲜橘子都被感染
        // 如果还有剩余，则说明有橘子无法被感染
        if fresh_count == 0 {
            minutes
        } else {
            -1
        }
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[2,1,1],[1,1,0],[0,1,1]]\n
// @lcpr case=end

// @lcpr case=start
// [[2,1,1],[0,1,1],[1,0,1]]\n
// @lcpr case=end

// @lcpr case=start
// [[0,2]]\n
// @lcpr case=end

 */
