/*
 * @lc app=leetcode.cn id=518 lang=rust
 * @lcpr version=30305
 *
 * [518] 零钱兑换 II
 */

// @lc code=start
impl Solution {
    /// 计算可以凑成总金额的硬币组合数。
    ///
    /// 使用完全背包的动态规划思想，并进行空间优化（滚动数组）。
    ///
    /// # Arguments
    /// * `amount`: 目标总金额。
    /// * `coins`: 不同面额的硬币数组。
    ///
    /// # Returns
    /// 返回可以凑成总金额的硬币组合数。如果无法凑成，返回 0。
    pub fn change(amount: i32, coins: Vec<i32>) -> i32 {
        let mut dp = vec![0; (amount + 1) as usize]; // dp[j] 表示凑成金额 j 的组合数
        dp[0] = 1;
        for &coin in &coins {
            for j in coin..=amount {
                // 状态转移：dp[j] = 不使用当前硬币的组合数 + 使用当前硬币的组合数
                // dp[j] (新) = dp[j] (旧) + dp[j - coin]
                dp[j as usize] += dp[(j - coin) as usize];
            }
        }
        dp[amount as usize]
    }
}
// @lc code=end

/*
// @lcpr case=start
// 5\n[1,2,5]\n
// @lcpr case=end

// @lcpr case=start
// 3\n[2]\n
// @lcpr case=end

// @lcpr case=start
// 10\n[10]\n
// @lcpr case=end

 */
