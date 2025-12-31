/*
 * @lc app=leetcode.cn id=877 lang=rust
 * @lcpr version=30305
 *
 * [877] 石子游戏
 */

// @lc code=start
impl Solution {
    /// 判断 Alice 是否能赢得石子游戏。
    ///
    /// 使用动态规划，计算 Alice 相对于 Bob 的最大石子数差。
    /// 如果石子数差大于 0，则 Alice 赢。
    ///
    /// # Arguments
    /// * `piles` - 包含每堆石子数量的数组。
    ///
    /// # Returns
    /// 如果 Alice 能赢得比赛，返回 true；否则返回 false。
    pub fn stone_game(piles: Vec<i32>) -> bool {
        let n = piles.len();
        if n == 0 {
            return false;
        }
        // dp[i][j] 表示在子数组 piles[i..=j] 中，当前玩家相对于对手的最大石子数差
        let mut dp = vec![vec![0; n]; n];
        for i in 0..n {
            dp[i][i] = piles[i];
        }
        for l in 2..=n {
            for i in (0..=(n - l)).rev() {
                let j = i + l - 1;
                // 当前玩家选择 piles[i] 或 piles[j]，并减去对手在剩余游戏中的优势
                dp[i][j] = (piles[i] - dp[i + 1][j]).max(piles[j] - dp[i][j - 1]);
            }
        }
        // dp[0][n-1] 表示整个数组中，Alice 相对于 Bob 的最大石子数差
        // 如果大于 0，则 Alice 获胜
        dp[0][n - 1] > 0
    }
}
// @lc code=end

/*
// @lcpr case=start
// [5,3,4,5]\n
// @lcpr case=end

// @lcpr case=start
// [3,7,2,3]\n
// @lcpr case=end

 */
