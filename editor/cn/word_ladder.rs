/*
 * @lc app=leetcode.cn id=127 lang=rust
 * @lcpr version=30305
 *
 * [127] 单词接龙
 */

// @lc code=start
use std::collections::{HashSet, VecDeque};
impl Solution {
    pub fn ladder_length(begin_word: String, end_word: String, word_list: Vec<String>) -> i32 {
        let mut word_set: HashSet<String> = word_list.into_iter().collect();
        if !word_set.contains(&end_word) {
            return 0;
        }
        word_set.remove(&begin_word);
        let mut queue: VecDeque<String> = VecDeque::new();
        let mut visited: HashSet<String> = HashSet::new();
        queue.push_back(begin_word.clone());
        visited.insert(begin_word);
        let mut step = 1;
        while !queue.is_empty() {
            let size = queue.len();
            for _ in 0..size {
                let cur_word = queue.pop_front().unwrap();
                let mut chars: Vec<char> = cur_word.chars().collect();
                for j in 0..chars.len() {
                    let original_char = chars[j];
                    for c in 'a'..='z' {
                        if c == original_char {
                            continue;
                        }
                        chars[j] = c;
                        let new_word: String = chars.iter().collect();
                        if word_set.contains(&new_word) && !visited.contains(&new_word) {
                            if new_word == end_word {
                                return step + 1;
                            }
                            queue.push_back(new_word.clone());
                            visited.insert(new_word);
                        }
                    }
                    chars[j] = original_char;
                }
            }
            step += 1;
        }
        0
    }
}
// @lc code=end

/*
// @lcpr case=start
// "hit"\n"cog"\n["hot","dot","dog","lot","log","cog"]\n
// @lcpr case=end

// @lcpr case=start
// "hit"\n"cog"\n["hot","dot","dog","lot","log"]\n
// @lcpr case=end

 */
