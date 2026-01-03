/*
 * @lc app=leetcode.cn id=714 lang=rust
 * @lcpr version=30305
 *
 * [714] 买卖股票的最佳时机含手续费
 */

// @lc code=start
impl Solution {
    pub fn max_profit(prices: Vec<i32>, fee: i32) -> i32 {
        let n = prices.len();
        let mut dp_i_0 = 0;
        let mut dp_i_1 = i32::MIN;
        let mut dp_pre_0 = 0;
        for i in 0..n {
            let temp = dp_i_0;
            dp_i_0 = dp_i_0.max(dp_i_1 + prices[i]);
            dp_i_1 = dp_i_1.max(temp - prices[i] - fee);
        }
        dp_i_0
    }
}
// @lc code=end

/*
// @lcpr case=start
// [1,3,2,8,4,9]\n2\n
// @lcpr case=end

// @lcpr case=start
// [1,3,7,5,10,3]\n3\n
// @lcpr case=end

 */
