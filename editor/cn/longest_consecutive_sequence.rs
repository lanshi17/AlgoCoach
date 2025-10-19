/*
 * @lc app=leetcode.cn id=128 lang=rust
 * @lcpr version=30203
 *
 * [128] 最长连续序列
 */

// @lc code=start
use std::collections::HashSet;
impl Solution {
    pub fn longest_consecutive(nums: Vec<i32>) -> i32 {
        let nums_set: HashSet<i32> = nums.into_iter().collect();
        let mut res: i32 = 0;
        for i in nums_set.iter() {
            if !nums_set.contains(&(i - 1)) {
                let mut cur_num = *i;
                let mut cur_len = 1;
                while nums_set.contains(&(cur_num + 1)) {
                    cur_num += 1;
                    cur_len += 1;
                }
                res = res.max(cur_len);
            }
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// [100,4,200,1,3,2]\n
// @lcpr case=end

// @lcpr case=start
// [0,3,7,2,5,8,4,6,0,1]\n
// @lcpr case=end

// @lcpr case=start
// [1,0,1,2]\n
// @lcpr case=end

 */
