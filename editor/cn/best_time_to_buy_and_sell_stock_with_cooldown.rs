/*
 * @lc app=leetcode.cn id=309 lang=rust
 * @lcpr version=30305
 *
 * [309] 买卖股票的最佳时机含冷冻期
 */

// @lc code=start
impl Solution {
    pub fn max_profit(prices: Vec<i32>) -> i32 {
        let n = prices.len();
        let mut dp_i_0 = 0;
        let mut dp_i_1 = i32::MIN;
        let mut dp_pre_0 = 0;
        for i in 0..n {
            let temp = dp_i_0;
            dp_i_0 = dp_i_0.max(dp_i_1 + prices[i]);
            dp_i_1 = dp_i_1.max(dp_pre_0 - prices[i]);
            dp_pre_0 = temp;
        }
        dp_i_0
    }
}
// @lc code=end

/*
// @lcpr case=start
// [1,2,3,0,2]\n
// @lcpr case=end

// @lcpr case=start
// [1]\n
// @lcpr case=end

 */
