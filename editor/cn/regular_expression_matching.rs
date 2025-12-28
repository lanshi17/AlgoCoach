/*
 * @lc app=leetcode.cn id=10 lang=rust
 * @lcpr version=30305
 *
 * [10] 正则表达式匹配
 */

// @lc code=start
impl Solution {
    /// 实现支持 '.' 和 '*' 的正则表达式匹配。
    ///
    /// '.' 匹配任意单个字符。
    /// '*' 匹配零个或多个前面的那一个元素。
    /// 匹配需要涵盖整个字符串 s。
    ///
    /// # Arguments
    /// * `s`: 待匹配的字符串。
    /// * `p`: 字符规律（模式）。
    ///
    /// # Returns
    /// 如果 s 完全匹配 p，则返回 true，否则返回 false。
    pub fn is_match(s: String, p: String) -> bool {
        let s_chars: Vec<char> = s.chars().collect();
        let p_chars: Vec<char> = p.chars().collect();
        let m = s_chars.len();
        let n = p_chars.len();

        // dp[i][j] 表示 s[0..i] 是否与 p[0..j] 匹配
        let mut dp = vec![vec![false; n + 1]; m + 1];

        // 空字符串与空模式匹配
        dp[0][0] = true;

        // 初始化第一行：s 为空字符串，p 不为空。
        // 只有 p 形如 "a*b*c*" 这样由 "字符*" 组成的模式才能匹配空字符串。
        for j in 2..=n {
            if p_chars[j - 1] == '*' {
                dp[0][j] = dp[0][j - 2];
            }
        }

        // 填充 dp 表
        for i in 1..=m {
            for j in 1..=n {
                let p_char = p_chars[j - 1];

                if p_char != '*' {
                    // p[j-1] 是普通字符或 '.'
                    // 匹配当前字符，且前面的子串也匹配
                    dp[i][j] = dp[i - 1][j - 1] && Self::matches(s_chars[i - 1], p_char);
                } else {
                    // p[j-1] 是 '*'
                    // 两种情况：
                    // 1. '*' 匹配零个前面的元素：dp[i][j-2] (忽略 "p[j-2]*")
                    // 2. '*' 匹配一个或多个前面的元素：当前字符 s[i-1] 与 p[j-2] 匹配 且 dp[i-1][j] (s 前进一位，p 原地继续匹配)
                    dp[i][j] = dp[i][j - 2] || // 零个
                               (Self::matches(s_chars[i - 1], p_chars[j - 2]) && dp[i - 1][j]);
                    // 一个或多个
                }
            }
        }

        dp[m][n]
    }

    /// 辅助函数：判断字符 s_char 是否与模式字符 p_char 匹配。
    /// p_char 可能是普通字母或 '.'。
    fn matches(s_char: char, p_char: char) -> bool {
        p_char == '.' || s_char == p_char
    }
}
// @lc code=end

/*
// @lcpr case=start
// "aa"\n"a"\n
// @lcpr case=end

// @lcpr case=start
// "aa"\n"a*"\n
// @lcpr case=end

// @lcpr case=start
// "ab"\n".*"\n
// @lcpr case=end

 */
