/*
 * @lc app=leetcode.cn id=1758 lang=rust
 * @lcpr version=30400
 *
 * [1758] 生成交替二进制字符串的最少操作数
 */

// @lc code=start
impl Solution {
    pub fn min_operations(s: String) -> i32 {
        let n = s.len() as i32;
        let mut mod_a = s
            .chars()
            .enumerate()
            .map(|(i, ch)| {
                let expected = if i % 2 == 0 { '0' } else { '1' };
                if ch == expected {
                    0
                } else {
                    1
                }
            })
            .sum::<i32>();
        mod_a.min(n - mod_a)
    }
}
// @lc code=end

/*
// @lcpr case=start
// "0100"\n
// @lcpr case=end

// @lcpr case=start
// "10"\n
// @lcpr case=end

// @lcpr case=start
// "1111"\n
// @lcpr case=end

 */
