/*
 * @lc app=leetcode.cn id=1905 lang=rust
 * @lcpr version=30304
 *
 * [1905] 统计子岛屿
 */

// @lc code=start
impl Solution {
    pub fn count_sub_islands(grid1: Vec<Vec<i32>>, grid2: Vec<Vec<i32>>) -> i32 {
        if grid1.is_empty() || grid2.is_empty() {
            return -1;
        }
        let m = grid1.len();
        let n = grid1[0].len();
        let mut grid2 = grid2;
        for i in 0..m {
            for j in 0..n {
                if grid1[i][j] == 0 && grid2[i][j] == 1 {
                    Self::dfs(&mut grid2, i, j);
                }
            }
        }
        let mut res = 0;
        for i in 0..m {
            for j in 0..n {
                if grid2[i][j] == 1 {
                    res += 1;
                    Self::dfs(&mut grid2, i, j);
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
        if j > 0 {
            Self::dfs(grid, i, j - 1);
        }
        Self::dfs(grid, i + 1, j);
        Self::dfs(grid, i, j + 1);
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[1,1,1,0,0],[0,1,1,1,1],[0,0,0,0,0],[1,0,0,0,0],[1,1,0,1,1]]\n[[1,1,1,0,0],[0,0,1,1,1],[0,1,0,0,0],[1,0,1,1,0],[0,1,0,1,0]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,0,1,0,1],[1,1,1,1,1],[0,0,0,0,0],[1,1,1,1,1],[1,0,1,0,1]]\n[[0,0,0,0,0],[1,1,1,1,1],[0,1,0,1,0],[0,1,0,1,0],[1,0,0,0,1]]\n
// @lcpr case=end

 */
