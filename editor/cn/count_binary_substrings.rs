/*
 * @lc app=leetcode.cn id=696 lang=rust
 * @lcpr version=30400
 *
 * [696] 计数二进制子串
 */

// @lc code=start
impl Solution {
    pub fn count_binary_substrings(s: String) -> i32 {
        let n = s.len();
        let s: Vec<char> = s.chars().collect();
        let mut prev_group = 0;
        let mut curr_group = 1;
        let mut res = 0;
        for i in 1..n {
            if s[i] == s[i - 1] {
                curr_group += 1;
            } else {
                res += prev_group.min(curr_group);
                prev_group = curr_group;
                curr_group = 1;
            }
        }
        res += prev_group.min(curr_group);
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// "00110011"\n
// @lcpr case=end

// @lcpr case=start
// "10101"\n
// @lcpr case=end

 */
