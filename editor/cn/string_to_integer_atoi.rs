/*
 * @lc app=leetcode.cn id=8 lang=rust
 * @lcpr version=30307
 *
 * [8] 字符串转换整数 (atoi)
 */

// @lc code=start
use std::{i32, i64};
impl Solution {
    pub fn my_atoi(s: String) -> i32 {
        let s = s.as_bytes();
        let n = s.len();
        let mut i = 0usize;
        let mut sign: i64 = 1; // 将 sign 也改为 i64，方便后续计算
        let mut res = 0i64;

        // 跳过前导空格
        while i < n && s[i] == b' ' {
            i += 1;
        }
        if i == n {
            return 0;
        }

        // 检查符号
        if s[i] == b'-' {
            sign = -1;
            i += 1;
        } else if s[i] == b'+' {
            i += 1;
        }
        if i == n {
            return 0;
        }

        // 读取数字字符
        while i < n && b'0' <= s[i] && s[i] <= b'9' {
            let digit = s[i] as i64 - b'0' as i64;

            // 在执行乘法和加法之前检查是否会溢出 i64
            // 检查 res * 10 + digit > i64::MAX
            // 等价于检查 res > (i64::MAX - digit) / 10
            if res > (i64::MAX - digit) / 10 {
                // 发生溢出，根据符号返回边界值
                return if sign == 1 {
                    i32::MAX
                } else {
                    i32::MIN
                };
            }
            res = res * 10 + digit;

            // 检查 res 是否已经超过了 i32 的上限，如果是，则可以提前处理正溢出
            // 但注意，我们不能只看 res，还要看 sign
            // 如果 sign 为正，且 res > i32::MAX，则正溢出
            // 如果 sign 为负，我们要看 res * sign，即 -res，看它是否小于 i32::MIN
            // 即 res > -i32::MIN。而 -i32::MIN = i32::MAX + 1 (在补码中)
            // 因为 i32::MIN = -2147483648, i32::MAX = 2147483647
            // 所以 -i32::MIN 在 i64 中就是 2147483648 = i32::MAX as i64 + 1
            if sign == 1 && res > i32::MAX as i64 {
                return i32::MAX;
            }
            if sign == -1 && res > (i32::MAX as i64) + 1 {
                // i32::MAX + 1 = -i32::MIN
                return i32::MIN;
            }
            i += 1;
        }

        // 循环结束后，res 必定在 i32 可表示的范围内（因为我们提前处理了溢出）
        // 因此，res * sign 也在 i32 范围内，可以直接转换
        (res * sign) as i32
    }
}
// @lc code=end

/*
// @lcpr case=start
// "42"\n
// @lcpr case=end

// @lcpr case=start
// "   -042"\n
// @lcpr case=end

// @lcpr case=start
// "1337c0d3"\n
// @lcpr case=end

// @lcpr case=start
// "0-1"\n
// @lcpr case=end

// @lcpr case=start
// "words and 987"\n
// @lcpr case=end

 */
