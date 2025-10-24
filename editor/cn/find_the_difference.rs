/*
 * @lc app=leetcode.cn id=389 lang=rust
 * @lcpr version=30300
 *
 * [389] 找不同
 */

// @lc code=start
impl Solution {
    pub fn find_the_difference(s: String, t: String) -> char {
        let mut res = 0;
        for c in s.chars() {
            res = res ^ (c as u8);
        }
        for d in t.chars() {
            res = res ^ (d as u8);
        }
        res as char
    }
}
// @lc code=end

/*
// @lcpr case=start
// "abcd"\n"abcde"\n
// @lcpr case=end

// @lcpr case=start
// ""\n"y"\n
// @lcpr case=end

 */
