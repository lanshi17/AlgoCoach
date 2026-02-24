/*
 * @lc app=leetcode.cn id=868 lang=rust
 * @lcpr version=30400
 *
 * [868] 二进制间距
 */

// @lc code=start
impl Solution {
    pub fn binary_gap(n: i32) -> i32 {
        let n = n as u32;
        let mut res = 0;
        let mut last_one_pos: Option<u32> = None;
        for pos in 0..32 {
            if (n >> pos) & 1 == 1 {
                if let Some(prev_one) = last_one_pos {
                    res = res.max(pos - prev_one);
                }
                last_one_pos = Some(pos);
            }
        }
        res as i32
    }
}
// @lc code=end

/*
// @lcpr case=start
// 22\n
// @lcpr case=end

// @lcpr case=start
// 8\n
// @lcpr case=end

// @lcpr case=start
// 5\n
// @lcpr case=end

 */
