/*
 * @lc app=leetcode.cn id=191 lang=rust
 * @lcpr version=30306
 *
 * [191] 位1的个数
 */

// @lc code=start
impl Solution {
    pub fn hamming_weight(mut n: i32) -> i32 {
        let mut res = 0;
        while n != 0 {
            n = n & (n - 1);
            res += 1;
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// 11\n
// @lcpr case=end

// @lcpr case=start
// 128\n
// @lcpr case=end

// @lcpr case=start
// 2147483645\n
// @lcpr case=end

 */
