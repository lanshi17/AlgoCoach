/*
 * @lc app=leetcode.cn id=3129 lang=rust
 * @lcpr version=30400
 *
 * [3129] 找出所有稳定的二进制数组 I
 */

// @lc code=start
impl Solution {
    pub fn number_of_stable_arrays(zero: i32, one: i32, limit: i32) -> i32 {
        let modulo = 1_000_000_007;
        let z = zero as usize;
        let o = one as usize;
        let l = limit as usize;

        // dp[i][j][0] 以0结尾, dp[i][j][1] 以1结尾
        let mut dp = vec![vec![[0_i64; 2]; o + 1]; z + 1];

        // 初始化边界条件 (只含 0 或只含 1 且不超 limit 的情况)
        for i in 1..=z.min(l) {
            dp[i][0][0] = 1;
        }
        for j in 1..=o.min(l) {
            dp[0][j][1] = 1;
        }

        for i in 1..=z {
            for j in 1..=o {
                // 计算以 0 结尾的情况
                dp[i][j][0] = (dp[i - 1][j][0] + dp[i - 1][j][1]) % modulo;
                if i > l {
                    dp[i][j][0] = (dp[i][j][0] - dp[i - l - 1][j][1] + modulo) % modulo;
                }

                // 计算以 1 结尾的情况
                dp[i][j][1] = (dp[i][j - 1][1] + dp[i][j - 1][0]) % modulo;
                if j > l {
                    dp[i][j][1] = (dp[i][j][1] - dp[i][j - l - 1][0] + modulo) % modulo;
                }
            }
        }

        ((dp[z][o][0] + dp[z][o][1]) % modulo) as i32
    }
}
// @lc code=end

/*
// @lcpr case=start
// 1\n1\n2\n
// @lcpr case=end

// @lcpr case=start
// 1\n2\n1\n
// @lcpr case=end

// @lcpr case=start
// 3\n3\n2\n
// @lcpr case=end

 */
