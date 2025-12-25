/*
 * @lc app=leetcode.cn id=1312 lang=rust
 * @lcpr version=30305
 *
 * [1312] 让字符串成为回文串的最少插入次数
 */

// @lc code=start
impl Solution {
    /// 计算让字符串 s 成为回文串所需的最少插入操作次数。
    ///
    /// 核心思想：最少插入次数 = 字符串长度 - 最长回文子序列的长度。
    /// 使用动态规划求最长回文子序列。
    ///
    /// # Arguments
    /// * `s`: 输入的字符串。
    ///
    /// # Returns
    /// 返回最少插入次数。
    pub fn min_insertions(s: String) -> i32 {
        let n = s.len();
        let s: Vec<char> = s.chars().collect();
        //dp[i][j] 表示字符串 s 在索引范围 [i, j] 内的最长回文子序列的长度。
        let mut dp = vec![vec![0; n]; n];
        for i in 0..n {
            dp[i][i] = 1;
        }
        for len in 2..=n {
            for i in 0..=(n - len) {
                let j = i + len - 1;
                if s[i] == s[j] {
                    dp[i][j] = dp[i + 1][j - 1] + 2;
                } else {
                    dp[i][j] = dp[i + 1][j].max(dp[i][j - 1]);
                }
            }
        }
        (n - dp[0][n - 1]) as i32
    }
}
// @lc code=end

/*
// @lcpr case=start
// "zzazz"\n
// @lcpr case=end

// @lcpr case=start
// "mbadm"\n
// @lcpr case=end

// @lcpr case=start
// "leetcode"\n
// @lcpr case=end

 */
