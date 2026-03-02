/*
 * @lc app=leetcode.cn id=1689 lang=rust
 * @lcpr version=30400
 *
 * [1689] 十-二进制数的最少数目
 */

// @lc code=start
impl Solution {
    pub fn min_partitions(n: String) -> i32 {
        n.chars()
            .map(|c| {
                c.to_digit(10)
                    .expect("Input string should only contain digits")
            })
            .max()
            .expect("Input string should not be empty") as i32
    }
}
// @lc code=end

/*
// @lcpr case=start
// "32"\n
// @lcpr case=end

// @lcpr case=start
// "82734"\n
// @lcpr case=end

// @lcpr case=start
// "27346209830709182346"\n
// @lcpr case=end

 */
