/*
 * @lc app=leetcode.cn id=357 lang=rust
 * @lcpr version=30307
 *
 * [357] 统计各位数字都不同的数字个数
 */

// @lc code=start
impl Solution {
    pub fn count_numbers_with_unique_digits(n: i32) -> i32 {
        if n == 0 {
            return 1;
        }
        if n == 1 {
            return 10;
        }
        let mut res = 9;
        for i in 1..n {
            res *= 10 - i;
        }
        res + Self::count_numbers_with_unique_digits(n - 1)
    }
}
// @lc code=end

/*
// @lcpr case=start
// 2\n
// @lcpr case=end

// @lcpr case=start
// 0\n
// @lcpr case=end

 */
