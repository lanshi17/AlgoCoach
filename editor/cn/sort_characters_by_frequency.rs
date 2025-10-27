/*
 * @lc app=leetcode.cn id=451 lang=rust
 * @lcpr version=30300
 *
 * [451] 根据字符出现频率排序
 */

// @lc code=start
use std::collections::{BinaryHeap, HashMap};
impl Solution {
    pub fn frequency_sort(s: String) -> String {
        let mut freq_map: HashMap<char, i32> = HashMap::new();
        let mut max_heap: BinaryHeap<(i32, char)> = BinaryHeap::new();
        let mut res = String::with_capacity(s.len());
        for c in s.chars() {
            *freq_map.entry(c).or_insert(0) += 1;
        }
        for (character, count) in freq_map {
            max_heap.push((count, character));
        }
        while let Some((count, character)) = max_heap.pop() {
            std::iter::repeat(character)
                .take(count as usize)
                .for_each(|_| res.push(character));
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// "tree"\n
// @lcpr case=end

// @lcpr case=start
// "cccaaa"\n
// @lcpr case=end

// @lcpr case=start
// "Aabb"\n
// @lcpr case=end

 */
