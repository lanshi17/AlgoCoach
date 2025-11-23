/*
 * @lc app=leetcode.cn id=200 lang=rust
 * @lcpr version=30304
 *
 * [200] 岛屿数量
 */

// @lc code=start
impl Solution {
    pub fn num_islands(grid: Vec<Vec<char>>) -> i32 {
        let mut grid = grid;
        let mut res = 0;
        let m = grid.len();
        let n = grid[0].len();

        for i in 0..m {
            for j in 0..n {
                if grid[i][j] == '1' {
                    res += 1;
                    Self::dfs(&mut grid, i, j);
                }
            }
        }
        res
    }

    fn dfs(grid: &mut Vec<Vec<char>>, i: usize, j: usize) {
        let m = grid.len();
        let n = grid[0].len();
        if i >= m || j >= n || grid[i][j] == '0' {
            return;
        }
        grid[i][j] = '0';
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
// [["1","1","1","1","0"],["1","1","0","1","0"],["1","1","0","0","0"],["0","0","0","0","0"]]\n
// @lcpr case=end

// @lcpr case=start
// [["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]\n
// @lcpr case=end

 */
