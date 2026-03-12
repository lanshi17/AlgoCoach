/*
 * @lc app=leetcode.cn id=1009 lang=rust
 * @lcpr version=30400
 *
 * [1009] 十进制整数的反码
 */

// @lc code=start
impl Solution {
    pub fn bitwise_complement(n: i32) -> i32 {
        if n == 0 {
            return 1;
        }
        let bit_length = 32 - n.leading_zeros();

        // 构造全是 1 的掩码
        let mask = (1 << bit_length) - 1;

        // 异或求反
        n ^ mask
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
// 10\n
// @lcpr case=end

 */
