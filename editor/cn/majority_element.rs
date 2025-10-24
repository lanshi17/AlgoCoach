/*
 * @lc app=leetcode.cn id=169 lang=rust
 * @lcpr version=30300
 *
 * [169] 多数元素
 */

use core::num;

// @lc code=start
impl Solution {
    pub fn majority_element(nums: Vec<i32>) -> i32 {
        if nums.is_empty() {
            return 0;
        }
        let mut target = 0;
        let mut count = 0;
        for i in 0..nums.len() {
            if count == 0 {
                target = nums[i];
                count = 1;
            } else if nums[i] == target {
                count += 1;
            } else if nums[i] != target {
                count -= 1;
            }
        }
        target
    }
}
// @lc code=end

/*
// @lcpr case=start
// [3,2,3]\n
// @lcpr case=end

// @lcpr case=start
// [2,2,1,1,1,2,2]\n
// @lcpr case=end

 */
