/*
 * @lc app=leetcode.cn id=17 lang=rust
 * @lcpr version=30304
 *
 * [17] 电话号码的字母组合
 */

// @lc code=start
use std::collections::HashMap;
struct BT {
    mapping: HashMap<char, &'static str>,
    res: Vec<String>,
    sb: String,
}
impl BT {
    fn new() -> Self {
        let mut mapping = HashMap::new();
        mapping.insert('2', "abc");
        mapping.insert('3', "def");
        mapping.insert('4', "ghi");
        mapping.insert('5', "jkl");
        mapping.insert('6', "mno");
        mapping.insert('7', "pqrs");
        mapping.insert('8', "tuv");
        mapping.insert('9', "wxyz");

        Self {
            mapping,
            res: Vec::new(),
            sb: String::new(),
        }
    }
    fn backtrace(&mut self, digits: &str, start: usize) {
        if self.sb.len() == digits.len() {
            self.res.push(self.sb.clone());
            return;
        }
        let digit = digits.chars().nth(start).unwrap();
        if let Some(letters) = self.mapping.get(&digit) {
            for c in letters.chars() {
                self.sb.push(c);
                self.backtrace(digits, start + 1);
                self.sb.pop();
            }
        }
    }
}
impl Solution {
    pub fn letter_combinations(digits: String) -> Vec<String> {
        let mut bt = BT::new();
        if digits.is_empty() {
            return bt.res.clone();
        }
        bt.backtrace(&digits, 0);
        bt.res.clone()
    }
}
// @lc code=end

/*
// @lcpr case=start
// "23"\n
// @lcpr case=end

// @lcpr case=start
// "2"\n
// @lcpr case=end

 */
