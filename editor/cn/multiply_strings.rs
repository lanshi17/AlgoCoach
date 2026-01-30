/*
 * @lc app=leetcode.cn id=43 lang=rust
 * @lcpr version=30307
 *
 * [43] 字符串相乘
 */

// @lc code=start
use std::char;
impl Solution {
    pub fn multiply(num1: String, num2: String) -> String {
        let n1 = num1.len();
        let n2 = num2.len();
        if num1 == "0" || num2 == "0" {
            return "0".to_string();
        }
        let mut res = vec![0; n1 + n2];
        // 从低位到高位逐位相乘
        for (i, c1) in num1.chars().rev().enumerate() {
            for (j, c2) in num2.chars().rev().enumerate() {
                // 注意这里是 i + j，因为 res 是倒序存储的
                let mul = (c1 as u8 - b'0') as usize * (c2 as u8 - b'0') as usize;
                // 先加上当前位置已有的值
                let sum = mul + res[i + j];
                res[i + j] = sum % 10;// 当前位
                res[i + j + 1] += sum / 10;// 进位
            }
        }
        // 去掉前导零
        while res.len() > 1 && *res.last().unwrap() == 0 {
            res.pop();
        }
        // 反转结果
        res.reverse();
        // 转换为字符串
        res.into_iter().map(|d| (d as u8 + b'0') as char).collect()
    }
}
// @lc code=end



/*
// @lcpr case=start
// "2"\n"3"\n
// @lcpr case=end

// @lcpr case=start
// "123"\n"456"\n
// @lcpr case=end

 */

