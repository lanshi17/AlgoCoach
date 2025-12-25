/*
 * @lc app=leetcode.cn id=64 lang=rust
 * @lcpr version=30305
 *
 * [64] 最小路径和
 */

// @lc code=start
impl Solution {
    /// 计算从左上角到右下角的最小路径和。
    ///
    /// 使用动态规划。
    ///
    /// # Arguments
    /// * `grid`: 包含非负整数的 m x n 网格。
    ///
    /// # Returns
    /// 返回最小路径和。
    pub fn min_path_sum(grid: Vec<Vec<i32>>) -> i32 {
        if grid.is_empty() {
            return 0;
        }
        let m = grid.len();
        let n = grid[0].len();
        let mut dp = vec![0; n];
        dp[0] = grid[0][0];
        for j in 1..n {
            dp[j] = dp[j - 1] + grid[0][j];
        }
        for i in 1..m {
            dp[0] += grid[i][0];
            for j in 1..n {
                dp[j] = grid[i][j] + dp[j].min(dp[j - 1]);
            }
        }
        dp[n - 1]
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[1,3,1],[1,5,1],[4,2,1]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,2,3],[4,5,6]]\n
// @lcpr case=end

 */
