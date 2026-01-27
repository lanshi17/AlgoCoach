/*
 * @lc app=leetcode.cn id=1201 lang=rust
 * @lcpr version=30307
 *
 * [1201] 丑数 III
 */

// @lc code=start
impl Solution {
    pub fn nth_ugly_number(n: i32, a: i32, b: i32, c: i32) -> i32 {
        let mut left = 1i64;
        let mut right: i64 = 2e9 as i64;
        let a = a as i64;
        let b = b as i64;
        let c = c as i64;
        while left < right {
            let mid = left + (right - left) / 2;
            // 集合论定理：A + B + C - A ∩ B - A ∩ C - B ∩ C + A ∩ B ∩ C
            let count = mid / a + mid / b + mid / c
                - mid / Self::lcm(a, b)
                - mid / Self::lcm(b, c)
                - mid / Self::lcm(a, c)
                + mid / Self::lcm(Self::lcm(a, b), c);
            if count >= n as i64 {
                right = mid;
            } else {
                left = mid + 1;
            }
        }
        left as i32
    }
    /// 最大公因数-辗转相除法
    fn gcd(x: i64, y: i64) -> i64 {
        if y == 0 {
            x
        } else {
            Self::gcd(y, x % y)
        }
    }
    fn lcm(x: i64, y: i64) -> i64 {
        // 最小公倍数就是乘积除以最大公因数
        x * y / Self::gcd(x, y)
    }
}
// @lc code=end

/*
// @lcpr case=start
// 3\n2\n3\n5\n
// @lcpr case=end

// @lcpr case=start
// 4\n2\n3\n4\n
// @lcpr case=end

// @lcpr case=start
// 5\n2\n11\n13\n
// @lcpr case=end

 */
