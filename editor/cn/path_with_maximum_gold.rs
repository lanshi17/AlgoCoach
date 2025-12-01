/*
 * @lc app=leetcode.cn id=1219 lang=rust
 * @lcpr version=30304
 *
 * [1219] 黄金矿工
 */

// @lc code=start
const DIRS: [(i32, i32); 4] = [
    (-1, 0), // 上
    (0, 1),  // 右
    (1, 0),  // 下
    (0, -1), // 左
];

impl Solution {
    pub fn get_maximum_gold(mut grid: Vec<Vec<i32>>) -> i32 {
        let m = grid.len();
        let n = grid[0].len();
        let mut max_gold = 0;

        // 遍历网格中的每一个单元格作为起点
        for i in 0..m {
            for j in 0..n {
                // 只有非零单元格才能作为路径的起点
                if grid[i][j] != 0 {
                    // 对于每个有效的起点，启动一次 DFS
                    // DFS 返回从该点出发能获得的最大黄金数
                    let current_max = Self::dfs(&mut grid, i as i32, j as i32);
                    // 更新全局最大值
                    max_gold = max_gold.max(current_max);
                }
            }
        }
        max_gold
    }

    // dfs 函数：从 (i, j) 出发，在当前状态下能获得的最大黄金数
    // 注意：grid 被标记为 mut，因为我们会在原地修改它来标记已访问，从而省去额外的 memo 数组
    fn dfs(grid: &mut Vec<Vec<i32>>, i: i32, j: i32) -> i32 {
        let m = grid.len() as i32;
        let n = grid[0].len() as i32;

        // 1. 边界检查和有效性检查
        // 检查是否越界，或者当前单元格没有黄金或已被访问（标记为0）
        if i < 0 || i >= m || j < 0 || j >= n || grid[i as usize][j as usize] == 0 {
            return 0; // 如果不能走，贡献为0
        }

        // 2. 前序操作：收集当前单元格的黄金并标记为已访问
        let gold = grid[i as usize][j as usize];
        grid[i as usize][j as usize] = 0; // 标记为已访问

        // 3. 递归探索：向四个方向探索，并找出能获得的最大黄金数
        let mut max_from_neighbors = 0;
        for &(di, dj) in &DIRS {
            let ni = i + di;
            let nj = j + dj;
            // 递归调用，获取从邻居出发能获得的最大黄金数
            let neighbor_gold = Self::dfs(grid, ni, nj);
            // 更新从当前点出发后续路径的最大收益
            max_from_neighbors = max_from_neighbors.max(neighbor_gold);
        }

        // 4. 后序操作（回溯）：恢复现场
        // 在返回之前，将当前单元格的状态恢复，以便其他路径可以访问它
        grid[i as usize][j as usize] = gold;

        // 返回从 (i,j) 出发能获得的最大黄金总数：
        // 当前格子的黄金 + 后续路径的最大黄金
        gold + max_from_neighbors
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[0,6,0],[5,8,7],[0,9,0]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,0,7],[2,0,6],[3,4,5],[0,3,0],[9,0,20]]\n
// @lcpr case=end

 */
