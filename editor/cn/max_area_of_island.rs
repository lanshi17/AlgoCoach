/*
 * @lc app=leetcode.cn id=695 lang=rust
 * @lcpr version=30304
 *
 * [695] 岛屿的最大面积
 */

// @lc code=start
impl Solution {
    pub fn max_area_of_island(grid: Vec<Vec<i32>>) -> i32 {
        let mut grid = grid;
        let mut res = 0;
        let m = grid.len();
        let n = grid[0].len();

        for i in 0..m {
            for j in 0..n {
                if grid[i][j] == 1 {
                    res = res.max(Self::dfs(&mut grid, i, j));
                }
            }
        }
        res
    }
    fn dfs(grid: &mut Vec<Vec<i32>>, i: usize, j: usize) -> i32 {
        let m = grid.len();
        let n = grid[0].len();
        if i >= m || j >= n || i < 0 || j < 0 || grid[i][j] == 0 {
            return 0;
        }
        grid[i][j] = 0;

        return Self::dfs(grid, i - 1, j)
            + Self::dfs(grid, i + 1, j)
            + Self::dfs(grid, i, j - 1)
            + Self::dfs(grid, i, j + 1)
            + 1;
    }
}

// @lc code=end

/*
// @lcpr case=start
// [[0,0,1,0,0,0,0,1,0,0,0,0,0],[0,0,0,0,0,0,0,1,1,1,0,0,0],[0,1,1,0,1,0,0,0,0,0,0,0,0],[0,1,0,0,1,1,0,0,1,0,1,0,0],[0,1,0,0,1,1,0,0,1,1,1,0,0],[0,0,0,0,0,0,0,0,0,0,1,0,0],[0,0,0,0,0,0,0,1,1,1,0,0,0],[0,0,0,0,0,0,0,1,1,0,0,0,0]]\n
// @lcpr case=end

// @lcpr case=start
// [[0,0,0,0,0,0,0,0]]\n
// @lcpr case=end

 */
