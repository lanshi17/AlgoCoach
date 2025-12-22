/*
 * @lc app=leetcode.cn id=416 lang=rust
 * @lcpr version=30305
 *
 * [416] 分割等和子集
 */

// @lc code=start
impl Solution {
    pub fn can_partition(nums: Vec<i32>) -> bool {
        let mut sum = nums.iter().sum();
        if sum % 2 != 0 {
            return false;
        }
        let n = nums.len();
        sum /= 2;
        let mut dp = vec![false; (sum + 1) as usize];
        dp[0] = true;
        for &num in &nums {
            for j in (num..=sum).rev() {
                dp[j as usize] = dp[j as usize] || dp[(j - num) as usize];
            }
        }
        dp[sum as usize]
    }
}
// @lc code=end

/*
// @lcpr case=start
// [1,5,11,5]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3,5]\n
// @lcpr case=end

 */
