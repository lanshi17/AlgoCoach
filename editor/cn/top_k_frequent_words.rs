/*
 * @lc app=leetcode.cn id=692 lang=rust
 * @lcpr version=30300
 *
 * [692] 前K个高频单词
 */

// @lc code=start
impl Solution {
    pub fn top_k_frequent(words: Vec<String>, k: i32) -> Vec<String> {
        use std::cmp::Reverse;
        use std::collections::{BinaryHeap, HashMap};
        let mut word_to_freq = HashMap::<String, usize>::new();
        words
            .into_iter()
            .for_each(|word| *word_to_freq.entry(word).or_default() += 1);
        word_to_freq
            .into_iter()
            .map(|(word, freq)| (Reverse(freq), word))
            .collect::<BinaryHeap<_>>()
            .into_sorted_vec()
            .into_iter()
            .map(|(_, w)| w)
            .take(k as usize)
            .collect()
    }
}
// @lc code=end

/*
// @lcpr case=start
// ["i", "love", "leetcode", "i", "love", "coding"]\n2\n
// @lcpr case=end

// @lcpr case=start
// 4\n
// @lcpr case=end

 */
