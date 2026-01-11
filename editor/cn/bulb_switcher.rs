/*
 * @lc app=leetcode.cn id=319 lang=rust
 * @lcpr version=30306
 *
 * [319] 灯泡开关
 */

// @lc code=start
impl Solution {
    /// Returns the number of bulbs that remain on after toggling `n` bulbs
    /// in rounds 1..=n.
    ///
    /// Bulb `k` is toggled once for each divisor of `k`, so it is toggled
    /// `d(k)` times, where `d(k)` is the number of positive divisors of `k`.
    /// A bulb ends up on only if it is toggled an odd number of times, i.e.
    /// only if `d(k)` is odd. This happens exactly when `k` is a perfect
    /// square, because only perfect squares have an unpaired divisor
    /// (their square root). Therefore, the bulbs that remain on are
    /// precisely those at perfect square positions up to `n`, and their
    /// count is `⌊√n⌋`.
    pub fn bulb_switch(n: i32) -> i32 {
        (n as f64).sqrt() as i32
    }
}
// @lc code=end

/*
// @lcpr case=start
// 3\n
// @lcpr case=end

// @lcpr case=start
// 0\n
// @lcpr case=end

// @lcpr case=start
// 1\n
// @lcpr case=end

 */
