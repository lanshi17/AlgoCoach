/*
 * @lc app=leetcode.cn id=372 lang=rust
 * @lcpr version=30307
 *
 * [372] 超级次方
 */

// @lc code=start
impl Solution {
    const BASE: i32 = 1337;

    /// 计算 a 的 k 次方然后与 BASE 求模的结果。
    /// 使用快速幂算法优化性能。
    ///
    /// # 参数
    /// * `a`: 底数。
    /// * `k`: 指数。
    ///
    /// # 返回值
    /// $(a^k) \bmod \text{BASE}$ 的结果。
    fn my_pow(a: i32, k: i32) -> i32 {
        // 对底数求模，防止初始值过大
        let mut base = (a % Self::BASE) as i64; // 使用 i64 防止中间计算溢出
        let mut exp = k as i64;
        let mut result = 1_i64;

        while exp > 0 {
            // 如果指数是奇数，将当前的 base 乘入结果
            if exp % 2 == 1 {
                result = (result * base) % Self::BASE as i64;
            }
            // 将底数平方，指数减半
            base = (base * base) % Self::BASE as i64;
            exp /= 2;
        }

        result as i32
    }

    /// 计算 $a^b \bmod 1337$，其中 $b$ 是一个表示大整数的数组。
    ///
    /// # 参数
    /// * `a`: 整数底数。
    /// * `b`: 表示大整数指数的数组。
    ///
    /// # 返回值
    /// $a^{\text{b[]}} \bmod 1337$ 的结果。
    ///
    /// # 示例
    /// ```
    /// let result = Solution::super_pow(2, vec![3]);
    /// assert_eq!(result, 8);
    ///
    /// let result = Solution::super_pow(2, vec![1, 0]); // 2^10
    /// assert_eq!(result, 1024);
    ///
    /// let result = Solution::super_pow(1, vec![4, 3, 3, 8, 5, 2]); // 1^...
    /// assert_eq!(result, 1);
    /// ```
    pub fn super_pow(a: i32, mut b: Vec<i32>) -> i32 {
        // 递归基础：如果指数数组为空，任何数的0次幂都是1
        if b.is_empty() {
            return 1;
        }

        // 提取指数的最后一位数字
        let last_digit = b.pop().unwrap(); // `pop` 返回 Option，unwrap 安全，因为 !b.is_empty()

        // 递归计算 a^(b_prefix)，其中 b_prefix 是去掉最后一位的数组
        let prefix_power = Self::super_pow(a, b);

        // 计算两部分：
        // part1 = a^(last_digit)
        let part1 = Self::my_pow(a, last_digit);
        // part2 = (a^(b_prefix))^10
        let part2 = Self::my_pow(prefix_power, 10);

        // 最终结果是 (part1 * part2) % BASE
        // 注意：part1 和 part2 都已经是 % BASE 的结果了，所以它们的乘积最多是 (BASE-1)^2
        // 仍可能超过 i32::MAX，所以需要先转为 i64 计算，再取模。
        ((part1 as i64 * part2 as i64) % Self::BASE as i64) as i32
    }
}
// @lc code=end

/*
// @lcpr case=start
// 2\n[3]\n
// @lcpr case=end

// @lcpr case=start
// 2\n[1,0]\n
// @lcpr case=end

// @lcpr case=start
// 1\n[4,3,3,8,5,2]\n
// @lcpr case=end

 */
