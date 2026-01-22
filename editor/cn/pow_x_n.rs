/*
 * @lc app=leetcode.cn id=50 lang=rust
 * @lcpr version=30307
 *
 * [50] Pow(x, n)
 */

// @lc code=start
use std::i32;
impl Solution {
    pub fn my_pow(x: f64, n: i32) -> f64 {
        // 处理指数为 0 的特殊情况
        if n == 0 {
            return 1.0;
        }

        // 处理指数为 i32::MIN 的特殊情况
        // 因为 -i32::MIN 会溢出 i32，所以我们特殊处理
        if n == i32::MIN {
            // x^(i32::MIN) = (x^2)^(i32::MIN / 2)
            // i32::MIN / 2 是一个确定的值
            // 由于 i32::MIN 是偶数，我们可以将其除以 2，然后平方结果
            let half_pow = Self::my_pow(x * x, n / 2);
            return half_pow;
        }

        // 处理负指数的情况
        if n < 0 {
            return 1.0 / Self::my_pow(x, -n); // 递归调用，传入正指数
        }

        // 此时 n > 0
        // 使用快速幂算法的核心逻辑
        if n % 2 == 1 {
            // n 是奇数: x^n = x * x^(n-1)
            x * Self::my_pow(x, n - 1)
        } else {
            // n 是偶数: x^n = (x^(n/2))^2
            let half_pow = Self::my_pow(x, n / 2);
            half_pow * half_pow
        }
    }
}
// @lc code=end

/*
// @lcpr case=start
// 2.00000\n10\n
// @lcpr case=end

// @lcpr case=start
// 2.10000\n3\n
// @lcpr case=end

// @lcpr case=start
// 2.00000\n-2\n
// @lcpr case=end

 */
