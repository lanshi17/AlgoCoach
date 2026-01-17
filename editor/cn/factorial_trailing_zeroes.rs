/*
 * @lc app=leetcode.cn id=172 lang=rust
 * @lcpr version=30306
 *
 * [172] 阶乘后的零
 */

// @lc code=start
impl Solution {
    pub fn trailing_zeroes(mut n: i32) -> i32 {
        let mut res = 0;
        while n / 5 > 0 {
            res += n / 5;
            n /= 5;
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// 3\n
// @lcpr case=end

// @lcpr case=start
// 5\n
// @lcpr case=end

// @lcpr case=start
// 0\n
// @lcpr case=end

 */
