/*
 * @lc app=leetcode.cn id=53 lang=rust
 * @lcpr version=30305
 *
 * [53] 最大子数组和
 */

// @lc code=start
use std::cmp::max;

impl Solution {
    /// 找出具有最大和的连续子数组的和。
    ///
    /// 使用 Kadane 算法（动态规划思想）。
    ///
    /// # 参数
    /// * `nums`: 整数数组。
    ///
    /// # 返回值
    /// 最大子数组的和。
    ///
    /// # Panics
    /// 如果输入数组为空，则会 panic。
    pub fn max_sub_array(nums: Vec<i32>) -> i32 {
        // 根据题目提示，数组至少有一个元素。
        // 初始化当前子数组和 (`_____________`) 和全局最大和 (`_____________`) 为第一个元素。
        let mut current_sum = nums[0];
        let mut max_sum = nums[0];

        // 从__________________开始遍历数组
        for i in 1..nums.len() {
            // 决定是延续之前的子数组还是从当前元素开始新的子数组
            // _____________ = max(___________, ________________________)
            current_sum = max(nums[i], current_sum + nums[i]);

            // 更新全局最大和
            max_sum = max_sum.max(current_sum);
        }

        max_sum
    }
}
// @lc code=end

/*
// @lcpr case=start
// [-2,1,-3,4,-1,2,1,-5,4]\n
// @lcpr case=end

// @lcpr case=start
// [1]\n
// @lcpr case=end

// @lcpr case=start
// [5,4,-1,7,8]\n
// @lcpr case=end

 */
