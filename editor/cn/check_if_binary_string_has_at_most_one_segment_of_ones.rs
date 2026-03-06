/*
 * @lc app=leetcode.cn id=1784 lang=rust
 * @lcpr version=30400
 *
 * [1784] 检查二进制字符串字段
 */

// @lc code=start
impl Solution {
    pub fn check_ones_segment(s: String) -> bool {
        !s.contains("01")
    }
}
// @lc code=end

/*
// @lcpr case=start
// "1001"\n
// @lcpr case=end

// @lcpr case=start
// "110"\n
// @lcpr case=end

 */
