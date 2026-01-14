/*
 * @lc app=leetcode.cn id=136 lang=rust
 * @lcpr version=30306
 *
 * [136] 只出现一次的数字
 */

// @lc code=start
impl Solution {
    pub fn single_number(nums: Vec<i32>) -> i32 {
        let mut res = 0;
        for n in nums {
            res ^= n;
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// [2,2,1]\n
// @lcpr case=end

// @lcpr case=start
// [4,1,2,1,2]\n
// @lcpr case=end

// @lcpr case=start
// [1]\n
// @lcpr case=end

 */
