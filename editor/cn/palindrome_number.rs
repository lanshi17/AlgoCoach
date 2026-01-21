/*
 * @lc app=leetcode.cn id=9 lang=rust
 * @lcpr version=30307
 *
 * [9] 回文数
 */

// @lc code=start
impl Solution {
    ///翻转后的数字和原数字一样就是回文数
    pub fn is_palindrome(x: i32) -> bool {
        if x < 0 || (x % 10 == 0 && x != 0) {
            return false;
        }
        let mut tmp = x;
        let mut y = 0i64;
        while tmp > 0 {
            let last_num = tmp % 10;
            tmp /= 10;
            y = y * 10 + last_num as i64;
        }
        y == x as i64
    }
}
// @lc code=end

/*
// @lcpr case=start
// 121\n
// @lcpr case=end

// @lcpr case=start
// -121\n
// @lcpr case=end

// @lcpr case=start
// 10\n
// @lcpr case=end

 */
