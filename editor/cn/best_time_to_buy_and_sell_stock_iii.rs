/*
 * @lc app=leetcode.cn id=123 lang=rust
 * @lcpr version=30305
 *
 * [123] 买卖股票的最佳时机 III
 */

// @lc code=start
impl Solution {
    // 状态转移方程：
    // dp[i][2][0] = max(dp[i-1][2][0], dp[i-1][2][1] + prices[i])
    // dp[i][2][1] = max(dp[i-1][2][1], dp[i-1][1][0] - prices[i])
    // dp[i][1][0] = max(dp[i-1][1][0], dp[i-1][1][1] + prices[i])
    // dp[i][1][1] = max(dp[i-1][1][1], -prices[i])
    pub fn max_profit(prices: Vec<i32>) -> i32 {
        let mut dp_i10 = 0;
        let mut dp_i11 = i32::MIN;
        let mut dp_i20 = 0;
        let mut dp_i21 = i32::MIN;
        for price in prices {
            dp_i20 = dp_i20.max(dp_i21 + price);
            dp_i21 = dp_i21.max(dp_i10 - price);
            dp_i10 = dp_i10.max(dp_i11 + price);
            dp_i11 = dp_i11.max(-price);
        }
        dp_i20
    }
}
// @lc code=end

/*
// @lcpr case=start
// [3,3,5,0,0,3,1,4]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3,4,5]\n
// @lcpr case=end

// @lcpr case=start
// [7,6,4,3,1]\n
// @lcpr case=end

 */
