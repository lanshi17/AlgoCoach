/*
 * @lc app=leetcode.cn id=122 lang=rust
 * @lcpr version=30305
 *
 * [122] 买卖股票的最佳时机 II
 */

// @lc code=start
impl Solution {
    pub fn max_profit(prices: Vec<i32>) -> i32 {
        let n = prices.len();
        let mut dp_i_0 = 0;
        let mut dp_i_1 = i32::MIN;
        for i in 0..n {
            let temp = dp_i_0;
            dp_i_0 = dp_i_0.max(dp_i_1 + prices[i]);
            dp_i_1 = dp_i_1.max(temp - prices[i])
        }
        dp_i_0
    }
}
// @lc code=end

/*
// @lcpr case=start
// [7,1,5,3,6,4]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3,4,5]\n
// @lcpr case=end

// @lcpr case=start
// [7,6,4,3,1]\n
// @lcpr case=end

 */
