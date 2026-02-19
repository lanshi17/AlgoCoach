/*
 * @lc app=leetcode.cn id=693 lang=rust
 * @lcpr version=30400
 *
 * [693] 交替位二进制数
 */

// @lc code=start
impl Solution {
    pub fn has_alternating_bits(n: i32) -> bool {
        (((n as u32) ^ (n as u32 >> 1)) & (((n as u32) ^ ((n as u32) >> 1)) + 1)) == 0
    }
}
// @lc code=end

/*
// @lcpr case=start
// 5\n
// @lcpr case=end

// @lcpr case=start
// 7\n
// @lcpr case=end

// @lcpr case=start
// 11\n
// @lcpr case=end

 */
