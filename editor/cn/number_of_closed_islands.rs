/*
 * @lc app=leetcode.cn id=1254 lang=rust
 * @lcpr version=30304
 *
 * [1254] 统计封闭岛屿的数目
 */

// @lc code=start
impl Solution {
    pub fn closed_island(mut grid: Vec<Vec<i32>>) -> i32 {
        let mut res = 0;
        let m = grid.len();
        let n = grid[0].len();

        for j in 0..n {
            Self::dfs(&mut grid, 0, j);
            Self::dfs(&mut grid, m - 1, j);
        }
        for i in 0..m {
            Self::dfs(&mut grid, i, 0);
            Self::dfs(&mut grid, i, n - 1);
        }
        for i in 0..m {
            for j in 0..n {
                if grid[i][j] == 0 {
                    res += 1;
                    Self::dfs(&mut grid, i, j);
                }
            }
        }
        res
    }
    fn dfs(grid: &mut Vec<Vec<i32>>, i: usize, j: usize) {
        let m = grid.len();
        let n = grid[0].len();
        if i >= m || j >= n || grid[i][j] != 0 {
            return;
        }
        grid[i][j] = 1;
        if i > 0 {
            Self::dfs(grid, i - 1, j); //up
        }
        Self::dfs(grid, i + 1, j); //down
        if j > 0 {
            Self::dfs(grid, i, j - 1); //left
        }
        Self::dfs(grid, i, j + 1); //right
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[1,1,1,1,1,1,1,0],[1,0,0,0,0,1,1,0],[1,0,1,0,1,1,1,0],[1,0,0,0,0,1,0,1],[1,1,1,1,1,1,1,0]]\n
// @lcpr case=end

// @lcpr case=start
// [[0,0,1,0,0],[0,1,0,1,0],[0,1,1,1,0]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,1,1,1,1,1,1],[1,0,0,0,0,0,1],[1,0,1,1,1,0,1],[1,0,1,0,1,0,1],[1,0,1,1,1,0,1],[1,0,0,0,0,0,1],[1,1,1,1,1,1,1]]\n
// @lcpr case=end

 */
