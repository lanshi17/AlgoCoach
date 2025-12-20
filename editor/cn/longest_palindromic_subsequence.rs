/*
 * @lc app=leetcode.cn id=516 lang=rust
 * @lcpr version=30305
 *
 * [516] 最长回文子序列
 */

// @lc code=start
impl Solution {
    /// 找到字符串 s 中最长回文子序列的长度。
    ///
    /// 使用状态压缩的动态规划方法，将空间复杂度优化至 O(N)。
    ///
    /// # 参数
    /// * `s`: 输入字符串。
    ///
    /// # 返回值
    /// 最长回文子序列的长度。
    pub fn longest_palindrome_subseq(s: String) -> i32 {
        let n = s.len();
        if n == 0 {
            return 0;
        }
        let chars: Vec<char> = s.chars().collect();
        // base case：dp 数组全部初始化为 1。
        // dp[j] 代表在某一层 i 的循环中，子串 s[i..=j] 的最长回文子序列长度。
        let mut dp = vec![1; n];
        // 从下往上填充 dp 表 (i 从 n-2 到 0)
        // 外层循环变量 i 代表子串的起始索引
        for i in (0..n - 1).rev() {
            // pre 用于保存来自上一轮内层循环的 dp[j] 值，即 dp[i+1][j]
            let mut pre = 0;
            // 内层循环变量 j 代表子串的结束索引，且 j > i
            for j in i + 1..n {
                // temp 临时保存当前 dp[j] 的值，以便在下一次迭代中成为新的 pre
                // 这相当于保存了 dp[i+1][j]，因为在更新 dp[j] 之前它就是旧值。
                let temp = dp[j];
                // 状态转移方程
                if chars[i] == chars[j] {
                    // 如果两端字符相同，则长度为内部子问题的解 + 2
                    // pre 在此时代表 dp[i+1][j-1]
                    dp[j] = pre + 2;
                } else {
                    // 如果两端字符不同，则取两种情况的最大值：
                    // 1. 忽略 s[i]，即 dp[i+1][j] (当前循环中未更新的 dp[j])
                    // 2. 忽略 s[j]，即 dp[i][j-1] (当前循环中已更新的 dp[j-1])
                    dp[j] = dp[j].max(dp[j - 1]);
                }

                // 更新 pre，为下一次内层循环迭代做准备
                // pre 现在保存的是本次迭代前的 dp[j]，即下一次迭代需要的 dp[i+1][j]
                pre = temp;
            }
        }

        // 循环结束后，dp[n-1] 存储的就是 s[0..=n-1] (即整个字符串) 的最长回文子序列长度
        dp[n - 1]
    }
}
// @lc code=end

/*
// @lcpr case=start
// "bbbab"\n
// @lcpr case=end

// @lcpr case=start
// "cbbd"\n
// @lcpr case=end

 */
