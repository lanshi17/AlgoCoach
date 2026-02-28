/*
 * @lc app=leetcode.cn id=1680 lang=rust
 * @lcpr version=30400
 *
 * [1680] 连接连续二进制数字
 */

// @lc code=start
const MOD: i64 = 1_000_000_007;
impl Solution {
    pub fn concatenated_binary(n: i32) -> i32 {
        let mut res = 0i64;
        let mut curr_bits = 0u32;
        for i in 1..=n as i64 {
            if i & (i - 1) == 0 {
                curr_bits += 1;
            }
            res = ((res << curr_bits) % MOD + i % MOD) % MOD;
        }
        res as i32
    }
}
// @lc code=end

/*
// @lcpr case=start
// 1\n
// @lcpr case=end

// @lcpr case=start
// 3\n
// @lcpr case=end

// @lcpr case=start
// 12\n
// @lcpr case=end

 */
