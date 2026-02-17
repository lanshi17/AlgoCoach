/*
 * @lc app=leetcode.cn id=190 lang=rust
 * @lcpr version=30400
 *
 * [190] 颠倒二进制位
 */

// @lc code=start
impl Solution {
    pub fn reverse_bits(mut n: i32) -> i32 {
        let mut res = 0i32;
        for _ in 0..32 {
            // 1. `res << 1`: 将当前结果 res 左移一位，为新的最低位腾出空间。
            // 2. `n & 1`: 获取 n 的Least Significant Bit。
            // 3. `|`: 将上一步得到的 LSB 添加到 res 的最低位上。
            res = (res << 1) | (n & 1);
            // 将 n 右移一位，丢弃已经处理过的最低位，准备处理下一位。
            n >>= 1;
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// 43261596\n
// @lcpr case=end

// @lcpr case=start
// 2147483644\n
// @lcpr case=end

 */
