/*
 * @lc app=leetcode.cn id=140 lang=rust
 * @lcpr version=30305
 *
 * [140] 单词拆分 II
 */

// @lc code=start
use std::collections::{HashMap, HashSet};
impl Solution {
    pub fn word_break(s: String, word_dict: Vec<String>) -> Vec<String> {
        let word_set: HashSet<&str> = word_dict.iter().map(|w| w.as_str()).collect();
        let mut memo: HashMap<usize, Vec<String>> = HashMap::new();
        Self::dfs(&s, 0, &word_set, &mut memo)
    }
    fn dfs(
        s: &str,
        start: usize,
        word_set: &HashSet<&str>,
        memo: &mut HashMap<usize, Vec<String>>,
    ) -> Vec<String> {
        if let Some(cached) = memo.get(&start) {
            return cached.clone();
        }
        if start == s.len() {
            return vec![String::new()];
        }
        let mut res = Vec::new();
        let suffix = &s[start..];
        for (char_idx, _) in suffix.char_indices() {
            let end = start + char_idx + 1;
            let prefix = &s[start..end];
            if word_set.contains(&prefix) {
                let sub_sentences = Self::dfs(s, end, word_set, memo);
                for sub_sentence in sub_sentences {
                    if sub_sentence.is_empty() {
                        res.push(prefix.to_string());
                    } else {
                        res.push(format!("{} {}", prefix, sub_sentence));
                    }
                }
            }
        }
        memo.insert(start, res.clone());
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// "catsanddog"\n["cat","cats","and","sand","dog"]\n
// @lcpr case=end

// @lcpr case=start
// "pineapplepenapple"\n["apple","pen","applepen","pine","pineapple"]\n
// @lcpr case=end

// @lcpr case=start
// "catsandog"\n["cats","dog","sand","and","cat"]\n
// @lcpr case=end

 */
