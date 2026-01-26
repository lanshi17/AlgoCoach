/*
 * @lc app=leetcode.cn id=11 lang=rust
 * @lcpr version=30307
 *
 * [11] 盛最多水的容器
 */

// @lc code=start
impl Solution {
    pub fn max_area(height: Vec<i32>) -> i32 {
        let mut left = 0;
        let mut right = height.len() - 1;
        let mut res = 0;
        while left < right {
            let h = height[left].min(height[right]);
            let w = (right - left) as i32;
            res = res.max(h * w);
            if height[left] < height[right] {
                left += 1;
            } else {
                right -= 1;
            }
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// [1,8,6,2,5,4,8,3,7]\n
// @lcpr case=end

// @lcpr case=start
// [1,1]\n
// @lcpr case=end

 */
