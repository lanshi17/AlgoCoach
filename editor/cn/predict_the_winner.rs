/*
 * @lc app=leetcode.cn id=486 lang=rust
 * @lcpr version=30305
 *
 * [486] 预测赢家
 */

// @lc code=start
impl Solution {
    /// 判断玩家 1 是否能成为游戏的赢家。
    ///
    /// 使用动态规划，计算玩家 1 相对于玩家 2 的最大分数差。
    /// 如果分数差大于等于 0，则玩家 1 赢或平。
    ///
    /// # Arguments
    /// * `nums` - 游戏用的整数数组。
    ///
    /// # Returns
    /// 如果玩家 1 能成为赢家，返回 true；否则返回 false。
    pub fn predict_the_winner(nums: Vec<i32>) -> bool {
        let n = nums.len();
        if n == 0 {
            return false;
        }
        let mut dp = vec![vec![0; n]; n];
        for i in 0..n {
            dp[i][i] = nums[i];
        }
        for l in 2..=n {
            for i in (0..=(n - l)).rev() {
                let j = i + l - 1;
                dp[i][j] = (nums[i] - dp[i + 1][j]).max(nums[j] - dp[i][j - 1]);
            }
        }
        dp[0][n - 1] >= 0
    }
}
// @lc code=end

/*
// @lcpr case=start
// [1,5,2]\n
// @lcpr case=end

// @lcpr case=start
// [1,5,233,7]\n
// @lcpr case=end

 */
