/*
 * @lc app=leetcode.cn id=762 lang=rust
 * @lcpr version=30400
 *
 * [762] 二进制表示中质数个计算置位
 */

// @lc code=start
impl Solution {
    pub fn count_prime_set_bits(left: i32, right: i32) -> i32 {
        let prime_table = Self::sieve_of_eratosthenes(32);

        let mut count = 0;
        for num in left..=right {
            let set_bits = num.count_ones() as usize;
            if prime_table[set_bits] {
                count += 1;
            }
        }
        count
    }
    fn sieve_of_eratosthenes(limit: usize) -> Vec<bool> {
        if limit < 2 {
            return vec![false; limit + 1];
        }

        let mut is_prime = vec![true; limit + 1];
        is_prime[0] = false;
        is_prime[1] = false;

        let mut p = 2;
        while p * p <= limit {
            if is_prime[p] {
                let mut multiple = p * p;
                while multiple <= limit {
                    is_prime[multiple] = false;
                    multiple += p;
                }
            }
            p += 1;
        }

        is_prime
    }
}
// @lc code=end

/*
// @lcpr case=start
// 6\n10\n
// @lcpr case=end

// @lcpr case=start
// 10\n15\n
// @lcpr case=end

 */
