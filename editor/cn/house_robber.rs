/*
 * @lc app=leetcode.cn id=198 lang=rust
 * @lcpr version=30305
 *
 * [198] 打家劫舍
 */

// @lc code=start
impl Solution {
    pub fn rob(nums: Vec<i32>) -> i32 {
        let n = nums.len();
        let (mut dp_i_1, mut dp_i_2) = (0, 0);
        let mut dp_i = 0;
        for i in (0..=(n - 1)).rev() {
            dp_i = dp_i_1.max(nums[i] + dp_i_2);
            dp_i_2 = dp_i_1;
            dp_i_1 = dp_i;
        }
        dp_i
    }
}
// @lc code=end

/*
// @lcpr case=start
// [1,2,3,1]\n
// @lcpr case=end

// @lcpr case=start
// [2,7,9,3,1]\n
// @lcpr case=end

 */
