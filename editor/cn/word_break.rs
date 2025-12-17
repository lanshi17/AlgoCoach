/*
 * @lc app=leetcode.cn id=139 lang=rust
 * @lcpr version=30305
 *
 * [139] 单词拆分
 */

// @lc code=start
use std::collections::HashSet;
impl Solution {
    pub fn word_break(s: String, word_dict: Vec<String>) -> bool {
        let word_set: HashSet<&str> = word_dict.iter().map(|w| w.as_str()).collect();
        let mut memo = vec![None; s.len()];
        Self::dp(&s, 0, &word_set, &mut memo)
    }
    fn dp(s: &str, i: usize, word_set: &HashSet<&str>, memo: &mut [Option<bool>]) -> bool {
        if s.len() == i {
            return true;
        }
        if let Some(is_breakable) = memo[i] {
            return is_breakable;
        }
        let substr = &s[i..];
        for (char_idx, _) in substr.char_indices() {
            let j = i + char_idx;
            let next_idx = j + 1;
            let pre_str = &s[i..next_idx];
            if word_set.contains(pre_str) {
                if Self::dp(s, next_idx, word_set, memo) {
                    memo[i] = Some(true);
                    return true;
                }
            }
        }
        memo[i] = Some(false);
        false
    }
}
// @lc code=end

/*
// @lcpr case=start
// "leetcode"\n["leet","code"]\n
// @lcpr case=end

// @lcpr case=start
// "applepenapple"\n["apple","pen"]\n
// @lcpr case=end

// @lcpr case=start
// "catsandog"\n["cats","dog","sand","and","cat"]\n
// @lcpr case=end

 */
