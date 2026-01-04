/*
 * @lc app=leetcode.cn id=188 lang=rust
 * @lcpr version=30305
 *
 * [188] 买卖股票的最佳时机 IV
 */

// @lc code=start
use std::cmp::max;
impl Solution {
    pub fn max_profit(k: i32, prices: Vec<i32>) -> i32 {
        let n = prices.len();
        let max_k = k as usize;
        if n <= 1 || max_k == 0 {
            return 0;
        }
        // 如果交易次数限制超过天数的一半，等同于无限制
        // 复用无限制交易次数的算法
        if max_k > n / 2 {
            return Self::max_profit_k_inf(&prices);
        }
        // 状态压缩：使用两个二维数组代替三维数组
        // prev_dp[k][s] 表示上一天的状态
        // curr_dp[k][s] 表示当前天的状态
        let mut prev_dp = vec![vec![0; 2]; max_k + 1];
        let mut curr_dp = vec![vec![0; 2]; max_k + 1];
        // 初始化 k=0 的情况 (交易次数为0，不能持有股票)
        for k in 0..=max_k {
            prev_dp[k][1] = i32::MIN; // 交易次数为0时，持有股票是非法状态
            prev_dp[k][0] = 0; // 交易次数为0时，不持有股票的利润为0
        }
        for i in 0..n {
            for k in 0..=max_k {
                curr_dp[k][0] = 0;
                curr_dp[k][1] = i32::MIN;
            }
            for k in (1..=max_k).rev() {
                // 当天不持有股票的状态转移
                // max(前一天也不持有, 前一天持有并在今天卖出)
                curr_dp[k][0] =
                    max(prev_dp[k][0], prev_dp[k][1].checked_add(prices[i]).unwrap_or(i32::MIN));

                // 当天持有股票的状态转移
                // max(前一天也持有, 前一天未持有并在今天买入)
                // 买入时交易次数k会减少1
                curr_dp[k][1] = max(
                    prev_dp[k][1],
                    prev_dp[k - 1][0].checked_sub(prices[i]).unwrap_or(i32::MIN),
                );
            }
            // 更新 prev_dp 为当前天的状态，供下一天使用
            std::mem::swap(&mut prev_dp, &mut curr_dp);
        }
        prev_dp[max_k][0]
    }
    /// 计算无交易次数限制下的最大利润 (用于 k > n/2 的情况)
    ///
    /// # 参数
    /// * `prices` - 每日股票价格数组
    ///
    /// # 返回值
    /// 返回无交易次数限制下能获得的最大利润
    fn max_profit_k_inf(prices: &Vec<i32>) -> i32 {
        if prices.is_empty() {
            return 0;
        }

        let mut hold = -prices[0]; // 持有股票时的最大利润
        let mut sold = 0; // 不持有股票时的最大利润

        for &price in prices.iter().skip(1) {
            let new_sold = max(sold, hold + price);
            let new_hold = max(hold, sold - price);

            sold = new_sold;
            hold = new_hold;
        }

        sold
    }
}
// @lc code=end

/*
// @lcpr case=start
// 2\n[2,4,1]\n
// @lcpr case=end

// @lcpr case=start
// 2\n[3,2,6,5,0,3]\n
// @lcpr case=end

 */
