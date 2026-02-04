/*
 * @lc app=leetcode.cn id=3640 lang=rust
 * @lcpr version=30307
 *
 * [3640] 三段式数组 II
 */

// @lc code=start
impl Solution {
    pub fn max_sum_trionic(nums: Vec<i32>) -> i64 {
        let n = nums.len();
        const INIT: i64 = i64::MIN / 2;
        let mut sum_max = INIT;
        let mut sub_sum_max = INIT;
        let mut sub_sub_sum_max = INIT;
        let mut res = INIT;
        for i in 1..n {
            let x = nums[i - 1] as i64;
            let y = nums[i] as i64;
            sum_max = if x < y {
                sum_max.max(sub_sum_max) + y
            } else {
                INIT
            };
            sub_sum_max = if x > y {
                sub_sum_max.max(sub_sub_sum_max) + y
            } else {
                INIT
            };
            sub_sub_sum_max = if x < y {
                sub_sub_sum_max.max(x) + y
            } else {
                INIT
            };
            res = res.max(sum_max);
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// [0,-2,-1,-3,0,2,-1]\n
// @lcpr case=end

// @lcpr case=start
// [1,4,2,7]\n
// @lcpr case=end

 */
