/*
 * @lc app=leetcode.cn id=417 lang=rust
 * @lcpr version=30304
 *
 * [417] 太平洋大西洋水流问题
 */

// @lc code=start
use std::collections::VecDeque;
/// 四个方向的偏移量：右、左、下、上
const DIRS: [[i32; 2]; 4] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

impl Solution {
    /// 给定一个 m x n 的整数矩阵 heights，其中 heights[r][c] 表示单元格 (r, c) 的高度。
    /// 太平洋位于大陆的左边界和上边界，大西洋位于右边界和下边界。
    /// 水只能从相邻的、高度小于或等于当前单元格的单元格流动。
    /// 返回所有既能流向太平洋又能流向大西洋的单元格坐标列表。
    ///
    /// # Arguments
    /// * `heights` - 一个二维向量，代表每个单元格的高度。
    ///
    /// # Returns
    /// * `Vec<Vec<i32>>` - 一个二维向量，包含所有满足条件的坐标 [row, col]。
    pub fn pacific_atlantic(heights: Vec<Vec<i32>>) -> Vec<Vec<i32>> {
        if heights.is_empty() || heights[0].is_empty() {
            return vec![];
        }

        let m = heights.len();
        let n = heights[0].len();
        let mut res: Vec<Vec<i32>> = Vec::new();

        // visited_P[i][j] 标记单元格 (i, j) 是否可以流向太平洋
        let mut visited_p = vec![vec![false; n]; m];
        // visited_A[i][j] 标记单元格 (i, j) 是否可以流向大西洋
        let mut visited_a = vec![vec![false; n]; m];

        // 初始化流向太平洋的起始点队列
        let mut queue_p: VecDeque<(usize, usize)> = VecDeque::new();
        // 第一列 (i, 0) 可以流向太平洋
        for i in 0..m {
            queue_p.push_back((i, 0));
            visited_p[i][0] = true;
        }
        // 第一行 (0, j) 可以流向太平洋 (注意 j 从 1 开始，避免重复添加 (0,0))
        for j in 1..n {
            queue_p.push_back((0, j));
            visited_p[0][j] = true;
        }
        // 执行 BFS，找出所有可以流向太平洋的单元格
        Self::bfs(&heights, &mut queue_p, &mut visited_p);

        // 初始化流向大西洋的起始点队列
        let mut queue_a: VecDeque<(usize, usize)> = VecDeque::new();
        // 最后一列 (i, n-1) 可以流向大西洋
        for i in 0..m {
            queue_a.push_back((i, n - 1));
            visited_a[i][n - 1] = true;
        }
        // 最后一行 (m-1, j) 可以流向大西洋 (注意 j < n-1，避免重复添加 (m-1, n-1))
        for j in 0..n - 1 {
            queue_a.push_back((m - 1, j));
            visited_a[m - 1][j] = true;
        }
        // 执行 BFS，找出所有可以流向大西洋的单元格
        Self::bfs(&heights, &mut queue_a, &mut visited_a);

        // 遍历所有单元格，找出同时可以流向太平洋和大西洋的单元格
        for i in 0..m {
            for j in 0..n {
                if visited_p[i][j] && visited_a[i][j] {
                    res.push(vec![i as i32, j as i32]);
                }
            }
        }

        res
    }

    /// 执行反向 BFS，从海岸线开始，寻找所有可以流到对应海洋的单元格。
    ///
    /// # Arguments
    /// * `heights` - 高度矩阵。
    /// * `queue` - BFS 队列，包含起始单元格。类型为 `VecDeque<(usize, usize)>`。
    /// * `visited` - 访问标记矩阵，会被此函数修改。
    fn bfs(
        heights: &Vec<Vec<i32>>,
        queue: &mut VecDeque<(usize, usize)>,
        visited: &mut Vec<Vec<bool>>,
    ) {
        let m = heights.len();
        let n = heights[0].len();

        while let Some((x, y)) = queue.pop_front() {
            let current_height = heights[x][y];

            for &[dx, dy] in &DIRS {
                // 计算下一个单元格的坐标 (next_x, next_y)，使用 i32 进行计算以方便边界检查
                let next_x_i32 = x as i32 + dx;
                let next_y_i32 = y as i32 + dy;

                // 检查边界条件
                if next_x_i32 < 0
                    || next_x_i32 >= m as i32
                    || next_y_i32 < 0
                    || next_y_i32 >= n as i32
                {
                    continue; // 坐标越界，跳过
                }

                // 将合法的 i32 坐标转换回 usize
                let next_x = next_x_i32 as usize;
                let next_y = next_y_i32 as usize;

                // 检查是否已访问
                if visited[next_x][next_y] {
                    continue; // 已访问过，跳过
                }

                // 反向检查：水能否从邻居单元格 (next_x, next_y) 流到当前单元格 (x, y)
                // 即，邻居的高度必须大于或等于当前单元格的高度
                if heights[next_x][next_y] >= current_height {
                    queue.push_back((next_x, next_y));
                    visited[next_x][next_y] = true; // 修正：正确设置 visited 矩阵
                }
            }
        }
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[1,2,2,3,5],[3,2,3,4,4],[2,4,5,3,1],[6,7,1,4,5],[5,1,1,2,4]]\n
// @lcpr case=end

// @lcpr case=start
// [[1]]\n
// @lcpr case=end

 */
