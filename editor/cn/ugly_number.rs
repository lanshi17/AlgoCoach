/*
 * @lc app=leetcode.cn id=263 lang=rust
 * @lcpr version=30307
 *
 * [263] 丑数
 */

// @lc code=start
impl Solution {
    pub fn is_ugly(n: i32) -> bool {
        let mut num = n;
        while num > 1 {
            if num % 2 == 0 {
                num /= 2;
            } else if num % 3 == 0 {
                num /= 3;
            } else if num % 5 == 0 {
                num /= 5;
            } else {
                return false;
            }
        }
        num == 1
    }
}
// @lc code=end

/*
// @lcpr case=start
// 6\n
// @lcpr case=end

// @lcpr case=start
// 1\n
// @lcpr case=end

// @lcpr case=start
// 14\n
// @lcpr case=end

 */
