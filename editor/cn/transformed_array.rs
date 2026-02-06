/*
 * @lc app=leetcode.cn id=3379 lang=rust
 * @lcpr version=30307
 *
 * [3379] 转换数组
 */

// @lc code=start
impl Solution {
    pub fn construct_transformed_array(nums: Vec<i32>) -> Vec<i32> {
        let n = nums.len();
        let mut result: Vec<i32> = vec![0; n];
        for i in 0..n {
            if nums[i] > 0 {
                result[i] = nums[((i as i32 + nums[i]) % n as i32) as usize];
            } else if nums[i] < 0 {
                result[i] =
                    nums[(((i as i32 + nums[i]) % n as i32 + n as i32) % n as i32) as usize];
            } else {
                result[i] = nums[i];
            }
        }
        result
    }
}
// @lc code=end

/*
// @lcpr case=start
// [3,-2,1,1]\n
// @lcpr case=end

// @lcpr case=start
// [-1,4,-1]\n
// @lcpr case=end

 */
