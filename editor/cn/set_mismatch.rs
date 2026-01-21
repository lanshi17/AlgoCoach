/*
 * @lc app=leetcode.cn id=645 lang=rust
 * @lcpr version=30307
 *
 * [645] 错误的集合
 */

// @lc code=start
impl Solution {
    pub fn find_error_nums(mut nums: Vec<i32>) -> Vec<i32> {
        let n = nums.len();
        let mut dup = -1;
        for i in 0..n {
            let index = nums[i].abs() as usize - 1;
            if nums[index] < 0 {
                dup = nums[i].abs();
            } else {
                nums[index] *= -1;
            }
        }
        let mut missing = -1;
        for i in 0..n {
            if nums[i] > 0 {
                missing = i as i32 + 1;
            }
        }
        return vec![dup, missing];
    }
}
// @lc code=end

/*
// @lcpr case=start
// [1,2,2,4]\n
// @lcpr case=end

// @lcpr case=start
// [1,1]\n
// @lcpr case=end

 */
