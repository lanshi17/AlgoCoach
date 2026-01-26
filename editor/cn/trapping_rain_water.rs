/*
 * @lc app=leetcode.cn id=42 lang=rust
 * @lcpr version=30307
 *
 * [42] 接雨水
 */

// @lc code=start
impl Solution {
    pub fn trap(height: Vec<i32>) -> i32 {
        let mut left = 0;
        let mut right = height.len() - 1;
        let mut left_max = 0;
        let mut right_max = 0;
        let mut res = 0;
        while left < right {
            left_max = left_max.max(height[left]);
            right_max = right_max.max(height[right]);
            if left_max < right_max {
                res += left_max - height[left];
                left += 1;
            } else {
                res += right_max - height[right];
                right -= 1;
            }
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// [0,1,0,2,1,0,1,3,2,1,2,1]\n
// @lcpr case=end

// @lcpr case=start
// [4,2,0,3,2,5]\n
// @lcpr case=end

 */
