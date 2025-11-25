/*
 * @lc app=leetcode.cn id=1020 lang=rust
 * @lcpr version=30304
 *
 * [1020] 飞地的数量
 */

// @lc code=start
impl Solution {
    pub fn num_enclaves(mut grid: Vec<Vec<i32>>) -> i32 {
        let mut res = 0;
        let m = grid.len();
        let n = grid[0].len();

        for j in 0..n {
            if grid[0][j] == 1 {
                Self::dfs(&mut grid, 0, j);
            }
            if grid[m - 1][j] == 1 {
                Self::dfs(&mut grid, m - 1, j);
            }
        }
        for i in 1..m - 1 {
            if grid[i][0] == 1 {
                Self::dfs(&mut grid, i, 0);
            }
            if grid[i][n - 1] == 1 {
                Self::dfs(&mut grid, i, n - 1);
            }
        }
        for i in 0..m {
            for j in 0..n {
                if grid[i][j] == 1 {
                    res += 1;
                }
            }
        }
        res
    }
    fn dfs(grid: &mut Vec<Vec<i32>>, i: usize, j: usize) {
        let m = grid.len();
        let n = grid[0].len();
        if i >= m || j >= n || grid[i][j] == 0 {
            return;
        }
        grid[i][j] = 0;

        if i > 0 {
            Self::dfs(grid, i - 1, j);
        }
        // 下
        if i < m - 1 {
            Self::dfs(grid, i + 1, j);
        }
        // 左
        if j > 0 {
            Self::dfs(grid, i, j - 1);
        }
        // 右
        if j < n - 1 {
            Self::dfs(grid, i, j + 1);
        }
    }
}

// @lc code=end

/*
// @lcpr case=start
// [[0,0,0,0],[1,0,1,0],[0,1,1,0],[0,0,0,0]]\n
// @lcpr case=end

// @lcpr case=start
// [[0,1,1,0],[0,0,1,0],[0,0,1,0],[0,0,0,0]]\n
// @lcpr case=end

 */
