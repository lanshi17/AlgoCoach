/*
 * @lc app=leetcode.cn id=583 lang=rust
 * @lcpr version=30305
 *
 * [583] 两个字符串的删除操作
 */

// @lc code=start
impl Solution {
    /// 计算使得 word1 和 word2 相同所需的最小删除步数。
    ///
    /// 解题思路：
    /// 1. 该问题可以转化为寻找两个字符串的最长公共子序列（LCS）。
    /// 2. 最少删除步数等于两个字符串总长度减去两倍的 LCS 长度。
    ///    即：steps = len(word1) + len(word2) - 2 * len(LCS)。
    /// 3. 使用动态规划计算 LCS 长度。
    ///
    /// # Arguments
    /// * `word1`: 第一个单词。
    /// * `word2`: 第二个单词。
    ///
    /// # Returns
    /// 返回所需的最小删除步数。
    pub fn min_distance(word1: String, word2: String) -> i32 {
        let (char1, char2) = if word1.len() >= word2.len() {
            (word1.as_bytes(), word2.as_bytes())
        } else {
            (word2.as_bytes(), word1.as_bytes())
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
        (m as i32) + (n as i32) - 2 * prev[n]
    }
}
// @lc code=end

/*
// @lcpr case=start
// "sea"\n"eat"\n
// @lcpr case=end

// @lcpr case=start
// "leetcode"\n"etco"\n
// @lcpr case=end

 */
