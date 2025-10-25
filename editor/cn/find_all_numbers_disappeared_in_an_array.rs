/*
 * @lc app=leetcode.cn id=448 lang=rust
 * @lcpr version=30300
 *
 * [448] 找到所有数组中消失的数字
 */

// @lc code=start
impl Solution {
    pub fn find_disappeared_numbers(mut nums: Vec<i32>) -> Vec<i32> {
        let mut res = Vec::new();
        for i in 0..nums.len() {
            let idx = nums[i].abs() - 1;
            if nums[idx as usize] > 0 {
                nums[idx as usize] *= -1;
            }
        }
        for i in 0..nums.len() {
            if nums[i as usize] > 0 {
                res.push((i + 1).try_into().unwrap());
            }
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// [4,3,2,7,8,2,3,1]\n
// @lcpr case=end

// @lcpr case=start
// [1,1]\n
// @lcpr case=end

 */
