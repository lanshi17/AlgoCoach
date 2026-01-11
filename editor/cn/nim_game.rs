/*
 * @lc app=leetcode.cn id=292 lang=rust
 * @lcpr version=30306
 *
 * [292] Nim 游戏
 */

// @lc code=start
impl Solution {
    pub fn can_win_nim(n: i32) -> bool {
        n % 4 != 0
    }
}
// @lc code=end

/*
// @lcpr case=start
// 4\n
// @lcpr case=end

// @lcpr case=start
// 1\n
// @lcpr case=end

// @lcpr case=start
// 2\n
// @lcpr case=end

 */
