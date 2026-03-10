/*
 * @lc app=leetcode.cn id=3130 lang=rust
 * @lcpr version=30400
 *
 * [3130] 找出所有稳定的二进制数组 II
 */

// @lc code=start
impl Solution {
    pub fn number_of_stable_arrays(zero: i32, one: i32, limit: i32) -> i32 {
        let modulo = 1_000_000_007;
        let z = zero as usize;
        let o = one as usize;
        let l = limit as usize;
        let max_n = z.max(o) + 2;

        // 预处理阶乘与逆元
        let mut fact = vec![1; max_n];
        let mut inv = vec![1; max_n];
        let mut fact_inv = vec![1; max_n];

        for i in 2..max_n {
            fact[i] = (fact[i - 1] * i as i64) % modulo;
            inv[i] = modulo - (modulo / i as i64) * inv[(modulo % i as i64) as usize] % modulo;
            fact_inv[i] = (fact_inv[i - 1] * inv[i]) % modulo;
        }

        let ncr = |n: usize, r: usize| -> i64 {
            if r > n {
                return 0;
            }
            fact[n] * fact_inv[r] % modulo * fact_inv[n - r] % modulo
        };

        // 计算将 n 个元素分成 k 块，每块不超过 limit 的方案数
        let calc_ways = |n: usize, k: usize, l: usize| -> i64 {
            if k == 0 || n < k || n > k * l {
                return 0;
            }
            let mut res = 0;
            for j in 0..=k.min((n - k) / l) {
                let term = ncr(k, j) * ncr(n - j * l - 1, k - 1) % modulo;
                if j % 2 == 1 {
                    res = (res - term + modulo) % modulo;
                } else {
                    res = (res + term) % modulo;
                }
            }
            res
        };

        let mut ans = 0;
        // 遍历可能的 0 的块数 k
        for k in 1..=z {
            let ways_z = calc_ways(z, k, l);
            if ways_z == 0 {
                continue;
            }

            // 1 的块数只能是 k-1, k, k+1
            let ways_o1 = calc_ways(o, k - 1, l);
            let ways_o2 = calc_ways(o, k, l);
            let ways_o3 = calc_ways(o, k + 1, l);

            // 排列方式: (k 块 0, k-1 块 1) + (k 块 0, k 块 1 的 2 种交替) + (k 块 0, k+1 块 1)
            let total_o_ways = (ways_o1 + 2 * ways_o2 + ways_o3) % modulo;
            ans = (ans + ways_z * total_o_ways) % modulo;
        }

        ans as i32
    }
}
// @lc code=end

/*
// @lcpr case=start
// 1\n1\n2\n
// @lcpr case=end

// @lcpr case=start
// 1\n2\n1\n
// @lcpr case=end

// @lcpr case=start
// 3\n3\n2\n
// @lcpr case=end

 */
