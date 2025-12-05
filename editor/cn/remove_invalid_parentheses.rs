/*
 * @lc app=leetcode.cn id=301 lang=rust
 * @lcpr version=30304
 *
 * [301] 删除无效的括号
 */

// @lc code=start
use std::collections::HashSet;
impl Solution {
    pub fn remove_invalid_parentheses(s: String) -> Vec<String> {
        let mut res = Vec::new();
        let mut track = String::new();
        Self::backtrack(&s, 0, 0, &mut track, &mut res);
        let max_len = res.iter().map(|s| s.len()).max().unwrap_or(0);
        let set: HashSet<String> = res.into_iter().filter(|s| s.len() == max_len).collect();
        set.into_iter().collect()
    }
    fn backtrack(s: &str, i: usize, left_count: i32, track: &mut String, res: &mut Vec<String>) {
        if i == s.len() {
            if Self::is_valid(track) {
                res.push(track.clone());
            }
            return;
        }
        let chars: Vec<char> = s.chars().collect();
        let c = chars[i];
        if c != '(' && c != ')' {
            track.push(c);
            Self::backtrack(s, i + 1, left_count, track, res);
            track.pop();
        } else {
            if left_count > 0 || c != ')' {
                track.push(c);
                let new_left_count = if c == '(' {
                    left_count + 1
                } else {
                    left_count - 1
                };
                Self::backtrack(s, i + 1, new_left_count, track, res);
                track.pop();
            }
            Self::backtrack(s, i + 1, left_count, track, res);
        }
    }
    fn is_valid(s: &str) -> bool {
        let mut left = 0;
        for c in s.chars() {
            if c == '(' {
                left += 1;
            } else if c == ')' {
                left -= 1;
                if left < 0 {
                    return false;
                }
            }
        }
        left == 0
    }
}
// @lc code=end

/*
// @lcpr case=start
// "()())()"\n
// @lcpr case=end

// @lcpr case=start
// "(a)())()"\n
// @lcpr case=end

// @lcpr case=start
// ")("\n
// @lcpr case=end

 */
