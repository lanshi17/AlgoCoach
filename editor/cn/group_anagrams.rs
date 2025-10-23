/*
 * @lc app=leetcode.cn id=49 lang=rust
 * @lcpr version=30300
 *
 * [49] 字母异位词分组
 */

// @lc code=start
use std::collections::HashMap;
impl Solution {
    pub fn group_anagrams(strs: Vec<String>) -> Vec<Vec<String>> {
        let mut anagram_map: HashMap<[i32; 26], Vec<String>> = HashMap::new();
        for s in strs {
            let mut freq = [0; 26];
            for c in s.chars() {
                if c.is_ascii_lowercase() {
                    freq[(c as u8 - b'a') as usize] += 1;
                }
            }
            anagram_map.entry(freq).or_insert_with(Vec::new).push(s);
        }
        anagram_map.into_iter().map(|(_, group)| group).collect()
    }
}
// @lc code=end

/*
// @lcpr case=start
// ["eat", "tea", "tan", "ate", "nat", "bat"]\n
// @lcpr case=end

// @lcpr case=start
// [""]\n
// @lcpr case=end

// @lcpr case=start
// ["a"]\n
// @lcpr case=end

 */
