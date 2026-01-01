/*
 * @lc app=leetcode.cn id=213 lang=rust
 * @lcpr version=30305
 *
 * [213] 打家劫舍 II
 */

// @lc code=start
impl Solution {
    /// 计算在环形街道上能偷窃到的最高金额。
    ///
    /// 通过将问题拆解为两个线性子问题来解决：
    /// 1. 不考虑最后一个房屋，计算 [0, n-2] 的最大值。
    /// 2. 不考虑第一个房屋，计算 [1, n-1] 的最大值。
    /// 最终结果是两个子问题结果的最大值。
    ///
    /// # Arguments
    /// * `nums` - 代表每个房屋存放金额的数组。
    ///
    /// # Returns
    /// 返回在不触发警报的情况下能偷窃到的最高金额。
    pub fn rob(nums: Vec<i32>) -> i32 {
        let n = nums.len();
        if n == 0 {
            return 0;
        }
        if n == 1 {
            return nums[0];
        }
        let max_without_last = Self::rob_linear(&nums[0..n - 1]);
        let max_without_first = Self::rob_linear(&nums[1..]);
        max_without_last.max(max_without_first)
    }
    /// 计算在线性街道（非环形）上能偷窃到的最高金额。
    /// 这是经典的“打家劫舍 I”问题。
    ///
    /// # Arguments
    /// * `nums` - 代表每个房屋存放金额的切片。
    ///
    /// # Returns
    /// 返回在不触发警报的情况下能偷窃到的最高金额。
    fn rob_linear(nums: &[i32]) -> i32 {
        let n = nums.len();
        if n == 0 {
            return 0;
        }
        if n == 1 {
            return nums[0];
        }
        let mut prev = nums[0]; //dp[i-2]
        let mut curr = nums[0].max(nums[1]); //dp[i-1]
                                             // dp[i] = max(dp[i-1], dp[i-2] + nums[i])
        for i in 2..n {
            let temp = curr;
            curr = curr.max(prev + nums[i]);
            prev = temp;
        }
        curr
    }
}
// @lc code=end

/*
// @lcpr case=start
// [2,3,2]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3,1]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3]\n
// @lcpr case=end

 */
