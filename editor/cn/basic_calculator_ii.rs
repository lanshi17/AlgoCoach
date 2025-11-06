/*
 * @lc app=leetcode.cn id=227 lang=rust
 * @lcpr version=30301
 *
 * [227] 基本计算器 II
 */

// @lc code=start
impl Solution {
    pub fn calculate(s: String) -> i32 {
        enum Operator {
            Add,
            Sub,
            Mul,
            Div,
            Ext,
        }
        let mut stack: Vec<i32> = Vec::new();
        let mut n = 0;
        let mut op = Operator::Add;
        for c in (s + ".").chars() {
            if c == ' ' {
                continue;
            }
            if c.is_ascii_digit() {
                n = (n << 3) + (n << 1) + (c as u8 - b'0') as i32;
            } else {
                match op {
                    Operator::Add => stack.push(n),
                    Operator::Sub => stack.push(-n),
                    Operator::Mul => *stack.last_mut().unwrap() *= n,
                    Operator::Div => *stack.last_mut().unwrap() /= n,
                    Operator::Ext => {},
                };
                op = match c {
                    '+' => Operator::Add,
                    '-' => Operator::Sub,
                    '*' => Operator::Mul,
                    '/' => Operator::Div,
                    _ => Operator::Ext,
                };
                n = 0;
            }
        }
        stack.iter().sum()
    }
}
// @lc code=end

/*
// @lcpr case=start
// "3+2*2"\n
// @lcpr case=end

// @lcpr case=start
// " 3/2 "\n
// @lcpr case=end

// @lcpr case=start
// " 3+5 / 2 "\n
// @lcpr case=end

 */
