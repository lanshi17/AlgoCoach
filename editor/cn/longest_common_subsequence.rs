/*
 * @lc app=leetcode.cn id=1143 lang=rust
 * @lcpr version=30305
 *
 * [1143] 最长公共子序列
 */

// @lc code=start
impl Solution {
    /// 使用滚动数组优化的自底向上动态规划方法计算两个字符串的最长公共子序列（LCS）长度。
    ///
    /// # 参数
    /// * `text1`: 第一个输入字符串。
    /// * `text2`: 第二个输入字符串。
    ///
    /// # 返回值
    /// 返回两个字符串的最长公共子序列的长度。如果不存在公共子序列，则返回 0。
    ///
    /// # 算法思路
    /// 1. 使用二维 DP 数组 `dp`，其中 `dp[i][j]` 表示 `text1[..i]` 和 `text2[..j]` 的 LCS 长度。
    /// 2. 状态转移：
    ///    - 如果 `text1[i-1] == text2[j-1]`，则 `dp[i][j] = dp[i-1][j-1] + 1`。
    ///    - 否则，`dp[i][j] = max(dp[i-1][j], dp[i][j-1])`。
    /// 3. 初始化：`dp[0][..]` 和 `dp[..][0]` 均为 0。
    /// 4. 为了优化空间，使用两个一维数组 (`prev` 和 `curr`) 来模拟二维 DP 的两行，实现滚动数组。
    ///
    /// # 时间复杂度
    /// O(m * n)，其中 m 和 n 分别是 `text1` 和 `text2` 的长度。
    ///
    /// # 空间复杂度
    /// O(min(m, n))，通过使用滚动数组优化，空间复杂度从 O(m*n) 降低到 O(n)。
    pub fn longest_common_subsequence(text1: String, text2: String) -> i32 {
        let (char1, char2) = if text1.len() >= text2.len() {
            (text1.as_bytes(), text2.as_bytes())
        } else {
            (text2.as_bytes(), text1.as_bytes())
        };
        let m = char1.len();
        let n = char2.len();
        let mut prev = vec![0; n + 1];
        let mut curr = vec![0; n + 1];
        for i in 1..=m {
            for j in 1..=n {
                if char1[i - 1] == char2[j - 1] {
                    curr[j] = prev[j - 1] + 1;
                } else {
                    curr[j] = prev[j].max(curr[j - 1]);
                }
            }
            std::mem::swap(&mut curr, &mut prev);
        }
        prev[n]
    }
}
// @lc code=end

/*
// @lcpr case=start
// "abcde"\n"ace"\n
// @lcpr case=end

// @lcpr case=start
// "abc"\n"abc"\n
// @lcpr case=end

// @lcpr case=start
// "abc"\n"def"\n
// @lcpr case=end

 */
