/*
 * @lc app=leetcode.cn id=268 lang=rust
 * @lcpr version=30306
 *
 * [268] 丢失的数字
 */

// @lc code=start
impl Solution {
    pub fn missing_number(nums: Vec<i32>) -> i32 {
        let mut res = 0;
        let n = nums.len();
        res ^= n as i32;
        for i in 0..n {
            res ^= i as i32 ^ nums[i];
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// [3,0,1]\n
// @lcpr case=end

// @lcpr case=start
// [0,1]\n
// @lcpr case=end

// @lcpr case=start
// [9,6,4,2,3,5,7,0,1]\n
// @lcpr case=end

 */
