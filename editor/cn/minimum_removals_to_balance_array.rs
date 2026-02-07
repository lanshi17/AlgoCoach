/*
 * @lc app=leetcode.cn id=3634 lang=rust
 * @lcpr version=30307
 *
 * [3634] 使数组平衡的最少移除数目
 */

// @lc code=start
use std::cmp::Ordering;

impl Solution {
    pub fn min_removal(mut nums: Vec<i32>, k: i32) -> i32 {
        let n = nums.len();
        if n <= 1 {
            return 0;
        }
        nums.sort_unstable();
        let mut max_len = 0;
        let mut left = 0;

        for right in 0..n {
            //saturating_mul防止溢出
            while left <= right && !nums[right].cmp(&(nums[left].saturating_mul(k))).is_le() {
                left += 1;
            }
            max_len = max_len.max(right - left + 1);
        }
        (n - max_len) as i32
    }
}
// @lc code=end

/*
// @lcpr case=start
// [2,1,5]\n2\n
// @lcpr case=end

// @lcpr case=start
// [1,6,2,9]\n3\n
// @lcpr case=end

// @lcpr case=start
// [4,6]\n2\n
// @lcpr case=end

 */
