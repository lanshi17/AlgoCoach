/*
 * @lc app=leetcode.cn id=231 lang=rust
 * @lcpr version=30306
 *
 * [231] 2 的幂
 */

// @lc code=start
impl Solution {
    pub fn is_power_of_two(n: i32) -> bool {
        if n <= 0 {
            return false;
        }
        (n & (n - 1)) == 0
    }
}
// @lc code=end

/*
// @lcpr case=start
// 1\n
// @lcpr case=end

// @lcpr case=start
// 16\n
// @lcpr case=end

// @lcpr case=start
// 3\n
// @lcpr case=end

 */
