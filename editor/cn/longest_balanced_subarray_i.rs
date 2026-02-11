/*
 * @lc app=leetcode.cn id=3719 lang=rust
 * @lcpr version=30307
 *
 * [3719] 最长平衡子数组 I
 */

// @lc code=start
use std::collections::HashSet;
impl Solution {
    pub fn longest_balanced(nums: Vec<i32>) -> i32 {
        let n = nums.len();
        (0..n)
            .map(|i| {
                let mut odds = HashSet::new();
                let mut evens = HashSet::new();
                let mut res = 0;

                for j in i..n {
                    let val = nums[j];
                    if val % 2 == 0 {
                        evens.insert(val);
                    } else {
                        odds.insert(val);
                    }

                    if odds.len() == evens.len() {
                        res = (j - i + 1) as i32;
                    }
                }
                res
            })
            .max()
            .unwrap_or(0)
    }
}
// @lc code=end

/*
// @lcpr case=start
// [2,5,4,3]\n
// @lcpr case=end

// @lcpr case=start
// [3,2,2,5,4]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3,2]\n
// @lcpr case=end

 */
