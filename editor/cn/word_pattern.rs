/*
 * @lc app=leetcode.cn id=290 lang=rust
 * @lcpr version=30300
 *
 * [290] 单词规律
 */

// @lc code=start
use std::collections::HashMap;
impl Solution {
    pub fn word_pattern(pattern: String, s: String) -> bool {
        let words: Vec<&str> = s.split_whitespace().collect();
        if pattern.len() != words.len() {
            return false;
        }
        let mut pattern_to_words: HashMap<char, &str> = HashMap::new();
        let mut words_to_pattern: HashMap<&str, char> = HashMap::new();
        for (character, &word) in pattern.chars().zip(words.iter()) {
            if let Some(existing_word) = pattern_to_words.get(&character) {
                if *existing_word != word {
                    return false;
                }
            } else {
                pattern_to_words.insert(character, word);
            }
            if let Some(existing_char) = words_to_pattern.get(word) {
                if *existing_char != character {
                    return false;
                }
            } else {
                words_to_pattern.insert(word, character);
            }
        }
        true
    }
}
// @lc code=end

/*
// @lcpr case=start
// "abba"\n"dog cat cat dog"\n
// @lcpr case=end

// @lcpr case=start
// "abba"\n"dog cat cat fish"\n
// @lcpr case=end

// @lcpr case=start
// "aaaa"\n"dog cat cat dog"\n
// @lcpr case=end

 */
