/*
 * @lc app=leetcode.cn id=242 lang=rust
 * @lcpr version=30300
 *
 * [242] 有效的字母异位词
 */

// @lc code=start
impl Solution {
    pub fn is_anagram(s: String, t: String) -> bool {
        if s.len() != t.len() {
            return false;
        }
        let mut count = vec![0; 26];
        for (char_s, char_t) in s.chars().zip(t.chars()) {
            if char_s.is_ascii_lowercase() && char_t.is_ascii_lowercase() {
                count[(char_s as u8 - b'a') as usize] += 1;
                count[(char_t as u8 - b'a') as usize] -= 1;
            } else {
                return false;
            }
        }
        count.iter().all(|&x| x == 0)
    }
}
// @lc code=end

/*
// @lcpr case=start
// "anagram"\n"nagaram"\n
// @lcpr case=end

// @lcpr case=start
// "rat"\n"car"\n
// @lcpr case=end

 */
