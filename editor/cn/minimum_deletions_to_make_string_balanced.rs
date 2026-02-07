/*
 * @lc app=leetcode.cn id=1653 lang=rust
 * @lcpr version=30307
 *
 * [1653] 使字符串平衡的最少删除次数
 */

// @lc code=start
use std::cmp;
impl Solution {
    pub fn minimum_deletions(mut s: String) -> i32 {
        let (_, res) = s
            .as_bytes()
            .iter()
            .fold((0, 0), |(mut b_count, mut res), &ch| {
                if ch == b'b' {
                    b_count += 1;
                } else {
                    res = cmp::min(res + 1, b_count);
                }
                (b_count, res)
            });
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// "aababbab"\n
// @lcpr case=end

// @lcpr case=start
// "bbaaaaabb"\n
// @lcpr case=end

 */
