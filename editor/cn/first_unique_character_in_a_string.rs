/*
 * @lc app=leetcode.cn id=387 lang=rust
 * @lcpr version=30300
 *
 * [387] 字符串中的第一个唯一字符
 */

// @lc code=start
impl Solution {
    pub fn first_uniq_char(s: String) -> i32 {
        if s.len() <= 0 {
            return -1;
        }
        let mut count = [0; 26];
        for c in s.chars() {
            count[(c as u8 - b'a') as usize] += 1;
        }
        for (i, c) in s.chars().enumerate() {
            if count[(c as u8 - b'a') as usize] == 1 {
                return i as i32;
            }
        }
        -1
    }
}
// @lc code=end

/*
// @lcpr case=start
// "leetcode"\n
// @lcpr case=end

// @lcpr case=start
// "loveleetcode"\n
// @lcpr case=end

// @lcpr case=start
// "aabb"\n
// @lcpr case=end

 */
