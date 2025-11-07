/*
 * @lc app=leetcode.cn id=1081 lang=rust
 * @lcpr version=30302
 *
 * [1081] 不同字符的最小子序列
 */

// @lc code=start
use std::collections::{HashMap, HashSet};
impl Solution {
    pub fn smallest_subsequence(s: String) -> String {
        let mut res: Vec<char> = Vec::new();
        let mut visited: HashSet<char> = HashSet::new();
        let mut last_idx: HashMap<char, usize> = HashMap::new();

        for (idx, val) in s.chars().enumerate() {
            last_idx.insert(val, idx);
        }

        for (idx, char) in s.chars().enumerate() {
            if !visited.contains(&char) {
                while let Some(&top) = res.last() {
                    if char < top && idx < *last_idx.get(&top).unwrap() {
                        visited.remove(&res.pop().unwrap());
                    } else {
                        break;
                    }
                }
                visited.insert(char);
                res.push(char);
            }
        }
        res.into_iter().collect()
    }
}
// @lc code=end

/*
// @lcpr case=start
// "bcabc"\n
// @lcpr case=end

// @lcpr case=start
// "cbacdcbc"\n
// @lcpr case=end

 */
