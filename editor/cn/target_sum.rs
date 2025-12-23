/*
 * @lc app=leetcode.cn id=494 lang=rust
 * @lcpr version=30305
 *
 * [494] 目标和
 */

// @lc code=start
impl Solution {
    /// 计算可以通过添加 '+' 或 '-' 号使数组元素和等于 target 的表达式数目。
    ///
    /// 使用 0-1 背包的动态规划思想，并进行空间优化（滚动数组）。
    /// 问题转化为：找到一个子集 P，使得 sum(P) = (target + total_sum) / 2。
    ///
    /// # Arguments
    /// * `nums`: 非负整数数组。
    /// * `target`: 目标和。
    ///
    /// # Returns
    /// 返回满足条件的表达式数目。
    pub fn find_target_sum_ways(nums: Vec<i32>, target: i32) -> i32 {
        let total_sum = nums.iter().sum();
        if (target + total_sum) % 2 != 0 || target.abs() > total_sum {
            return 0;
        }
        let target_sum = (target + total_sum) / 2;
        if target_sum < 0 {
            return 0;
        }
        let mut dp = vec![0; (target_sum + 1) as usize];
        dp[0] = 1;
        for &num in &nums {
            for j in (num..=target_sum).rev() {
                dp[j as usize] += dp[(j - num) as usize];
            }
        }
        dp[target_sum as usize]
    }
}
// @lc code=end

/*
// @lcpr case=start
// [1,1,1,1,1]\n3\n
// @lcpr case=end

// @lcpr case=start
// [1]\n1\n
// @lcpr case=end

 */
