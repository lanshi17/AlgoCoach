/*
 * @lc app=leetcode.cn id=400 lang=rust
 * @lcpr version=30307
 *
 * [400] 第 N 位数字
 */

// @lc code=start
impl Solution {
    pub fn find_nth_digit(n: i32) -> i32 {
        let mut n = n as i64;
        let mut digit = 1i64;
        let mut base = 1i64;
        while n > 9 * digit * base {
            n -= 9 * digit * base;
            digit += 1;
            base *= 10;
        }
        let target_num = base + (n - 1) / digit;
        let digit_index = ((n - 1) % digit) as usize;
        let remaining = digit as usize - digit_index - 1;
        let number_after_shift = target_num / 10i64.pow(remaining as u32);
        (number_after_shift % 10) as i32
    }
}
// @lc code=end

/*
// @lcpr case=start
// 3\n
// @lcpr case=end

// @lcpr case=start
// 11\n
// @lcpr case=end

 */
