/*
 * @lc app=leetcode.cn id=712 lang=rust
 * @lcpr version=30305
 *
 * [712] 两个字符串的最小ASCII删除和
 */

// @lc code=start
impl Solution {
    /// 计算使两个字符串相等所需删除字符的 ASCII 值的最小和 (滚动数组优化版)。
    ///
    /// # Arguments
    /// * `s1`: 第一个字符串。
    /// * `s2`: 第二个字符串。
    ///
    /// # Returns
    /// 返回所需删除字符的 ASCII 值的最小和。
    pub fn minimum_delete_sum(s1: String, s2: String) -> i32 {
        let (char1, char2) = if s1.len() >= s2.len() {
            (s1.as_bytes(), s2.as_bytes())
        } else {
            (s2.as_bytes(), s1.as_bytes())
        };
        let m = char1.len();
        let n = char2.len();
        let mut prev = vec![0; n + 1]; //prev[k]=dp[i-1][k]
        let mut curr = vec![0; n + 1]; //curr[k]=dp[i][k]
        for j in 1..=n {
            prev[j] = prev[j - 1] + char2[j - 1] as i32;
        }
        for i in 1..=m {
            curr[0] = prev[0] + char1[i - 1] as i32;
            for j in 1..=n {
                if char1[i - 1] == char2[j - 1] {
                    curr[j] = prev[j - 1];
                } else {
                    let delete_from_s1 = prev[j] + char1[i - 1] as i32;
                    let delete_from_s2 = curr[j - 1] + char2[j - 1] as i32;
                    curr[j] = delete_from_s1.min(delete_from_s2);
                }
            }
            std::mem::swap(&mut prev, &mut curr);
        }
        prev[n]
    }
}
// @lc code=end

/*
// @lcpr case=start
// "sea"\n"eat"\n
// @lcpr case=end

// @lcpr case=start
// "delete"\n"leet"\n
// @lcpr case=end

 */
