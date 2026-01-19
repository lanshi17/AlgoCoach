/*
 * @lc app=leetcode.cn id=204 lang=rust
 * @lcpr version=30307
 *
 * [204] 计数质数
 */

// @lc code=start
impl Solution {
    pub fn count_primes(n: i32) -> i32 {
        if n <= 2 {
            return 0;
        }
        let n = n as usize;
        let mut is_prime = vec![true; n];
        if n > 0 {
            is_prime[0] = false;
        }
        if n > 1 {
            is_prime[1] = false;
        }
        let limit = (n as f64).sqrt() as usize + 1;
        for i in 2..limit {
            if is_prime[i] {
                let mut j = i * i;
                while j < n {
                    is_prime[j] = false;
                    j += i;
                }
            }
        }
        is_prime.iter().filter(|&&is_p| is_p).count() as i32
    }
}
// @lc code=end

/*
// @lcpr case=start
// 10\n
// @lcpr case=end

// @lcpr case=start
// 0\n
// @lcpr case=end

// @lcpr case=start
// 1\n
// @lcpr case=end

 */
