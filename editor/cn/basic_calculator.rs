/*
 * @lc app=leetcode.cn id=224 lang=rust
 * @lcpr version=30301
 *
 * [224] 基本计算器
 */

// @lc code=start
impl Solution {
    pub fn calculate(s: String) -> i32 {
        let chars: Vec<char> = s.chars().collect();
        let mut nums: Vec<i32> = vec![0]; // 存储操作数栈，初始化为0以处理表达式开头的负数
        let mut ops: Vec<char> = Vec::new(); // 存储操作符 '+' '-' '('

        let mut num = 0; // 当前正在解析的数字
        let mut sign = 1; // 当前数字的符号: 1 for positive, -1 for negative

        for &c in &chars {
            match c {
                ' ' => {}, // 忽略空格
                '+' | '-' => {
                    nums.last_mut().map(|x| *x += num * sign);
                    sign = if c == '+' {
                        1
                    } else {
                        -1
                    };
                    num = 0; // 重置数字
                },
                '(' => {
                    // 遇到左括号，将当前结果和符号压入栈
                    nums.push(0);
                    ops.push(if sign == 1 {
                        '+'
                    } else {
                        '-'
                    });
                    sign = 1; // 括号内第一个数字的符号默认为正
                },
                ')' => {
                    // 将括号内最后一个数字加到结果中
                    let inner_res = num * sign;
                    num = nums.pop().unwrap() + inner_res;

                    // 根据括号前的操作符调整结果符号
                    let op_sign = if ops.pop().unwrap() == '+' {
                        1
                    } else {
                        -1
                    };
                    *nums.last_mut().unwrap() += num * op_sign;
                    num = 0;
                    sign = 1;
                },
                _ => {
                    // 解析数字字符
                    // 使用位运算优化: num = num * 10 + digit
                    // 10 = 8 + 2 = 2^3 + 2^1
                    // 所以 num * 10 = (num << 3) + (num << 1)
                    let digit = c as i32 - '0' as i32;
                    num = (num << 3) + (num << 1) + digit;
                },
            }
        }

        // 处理表达式最后的数字
        nums.last_mut().map(|x| *x += num * sign);
        nums[0]
    }
}
// @lc code=end

/*
// @lcpr case=start
// "1 + 1"\n
// @lcpr case=end

// @lcpr case=start
// " 2-1 + 2 "\n
// @lcpr case=end

// @lcpr case=start
// "(1+(4+5+2)-3)+(6+8)"\n
// @lcpr case=end

 */
