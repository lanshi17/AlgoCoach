/*
 * @lc app=leetcode.cn id=316 lang=rust
 * @lcpr version=30302
 *
 * [316] 去除重复字母
 */

// @lc code=start
use std::collections::{HashMap, HashSet};
impl Solution {
    pub fn remove_duplicate_letters(s: String) -> String {
        let mut stack: Vec<char> = Vec::new(); //单调栈
        let mut seen: HashSet<char> = HashSet::new(); //标记已存放的字符
        let mut last_occ: HashMap<char, usize> = HashMap::new(); //字符最后出现的索引位置
        for (idx, val) in s.chars().enumerate() {
            last_occ.insert(val, idx);
        }
        for (idx, val) in s.chars().enumerate() {
            if !seen.contains(&val) {
                while let Some(&top) = stack.last() {
                    if val < top && idx < *last_occ.get(&top).unwrap() {
                        seen.remove(&stack.pop().unwrap());
                    } else {
                        break;
                    }
                }
                seen.insert(val);
                stack.push(val);
            }
        }
        stack.into_iter().collect()
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
