/*
 * @lc app=leetcode.cn id=784 lang=rust
 * @lcpr version=30304
 *
 * [784] 字母大小写全排列
 */

// @lc code=start
impl Solution {
    pub fn letter_case_permutation(s: String) -> Vec<String> {
        let mut res: Vec<String> = Vec::new();
        let mut path = String::new();
        Self::backtrack(&s, 0, &mut path, &mut res);
        res
    }
    fn backtrack(s: &str, start: usize, path: &mut String, res: &mut Vec<String>) {
        if start == s.len() {
            res.push(path.clone());
            return;
        }

        let current_char = s.chars().nth(start).unwrap();
        if current_char.is_ascii_digit() {
            path.push(current_char);
            Self::backtrack(s, start + 1, path, res);
            path.pop();
        } else {
            path.push(current_char.to_ascii_lowercase());
            Self::backtrack(s, start + 1, path, res);
            path.pop();
            path.push(current_char.to_ascii_uppercase());
            Self::backtrack(s, start + 1, path, res);
            path.pop();
        }
    }
}
// @lc code=end

/*
// @lcpr case=start
// "a1b2"\n
// @lcpr case=end

// @lcpr case=start
// "3z4"\n
// @lcpr case=end

 */
