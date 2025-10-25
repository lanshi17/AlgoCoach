/*
 * @lc app=leetcode.cn id=442 lang=rust
 * @lcpr version=30300
 *
 * [442] 数组中重复的数据
 */

// @lc code=start
impl Solution {
    pub fn find_duplicates(mut nums: Vec<i32>) -> Vec<i32> {
        let mut res = Vec::new();
        for i in 0..nums.len() {
            let num = nums[i];
            let idx = (num.abs() - 1) as usize;
            if nums[idx] < 0 {
                res.push(num.abs());
            } else {
                nums[idx] *= -1;
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
// [1,1,2]\n
// @lcpr case=end

// @lcpr case=start
// [1]\n
// @lcpr case=end

 */
