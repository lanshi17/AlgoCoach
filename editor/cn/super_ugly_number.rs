/*
 * @lc app=leetcode.cn id=313 lang=rust
 * @lcpr version=30300
 *
 * [313] 超级丑数
 */

// @lc code=start
use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashSet};
impl Solution {
    pub fn nth_super_ugly_number(n: i32, primes: Vec<i32>) -> i32 {
        let mut heap: BinaryHeap<Reverse<i64>> = BinaryHeap::new();
        let mut seen: HashSet<i64> = HashSet::new();
        let primes: Vec<i64> = primes.into_iter().map(|x| x as i64).collect();
        heap.push(Reverse(1));
        seen.insert(1);
        let mut current_ugly: i64 = 1;
        for _ in 0..n {
            if let Some(Reverse(ugly)) = heap.pop() {
                current_ugly = ugly;
                for &prime in &primes {
                    let new_ugly = current_ugly * prime;
                    if !seen.contains(&new_ugly) {
                        heap.push(Reverse(new_ugly));
                        seen.insert(new_ugly);
                    }
                }
            }
        }
        current_ugly as i32
    }
}
// @lc code=end

/*
// @lcpr case=start
// 12\n[2,7,13,19]\n
// @lcpr case=end

// @lcpr case=start
// 1\n[2,3,5]\n
// @lcpr case=end

 */
