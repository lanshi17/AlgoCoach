/*
 * @lc app=leetcode.cn id=473 lang=rust
 * @lcpr version=30304
 *
 * [473] 火柴拼正方形
 */

// @lc code=start
use std::collections::HashMap;
impl Solution {
    pub fn makesquare(matchsticks: Vec<i32>) -> bool {
        Self::can_partition_KSubsets(&matchsticks, 4)
    }
    fn can_partition_KSubsets(nums: &Vec<i32>, k: i32) -> bool {
        if k > nums.len() as i32 {
            return false;
        }
        let sum: i32 = nums.iter().sum();
        if sum % k != 0 {
            return false;
        }
        let mut memo: HashMap<u32, bool> = HashMap::new();
        let mut used: u32 = 0;
        let target = sum / k;
        Self::backtrace(&nums, k, 0, 0, used, target, &mut memo)
    }
    fn backtrace(
        nums: &Vec<i32>,
        k: i32,
        bucket: i32,
        start: usize,
        used: u32,
        target: i32,
        memo: &mut HashMap<u32, bool>,
    ) -> bool {
        if k == 0 {
            return true;
        }
        if bucket == target {
            let res = Self::backtrace(nums, k - 1, 0, 0, used, target, memo);
            memo.insert(used, res);
            return res;
        }
        if let Some(&cached_res) = memo.get(&used) {
            return cached_res;
        }
        for i in start..nums.len() {
            if (used >> i) & 1 == 1 {
                continue;
            }
            if nums[i] + bucket > target {
                continue;
            }
            let new_used = used | (1 << i);
            let new_bucket = nums[i] + bucket;
            if Self::backtrace(nums, k, new_bucket, i + 1, new_used, target, memo) {
                return true;
            }
        }
        memo.insert(used, false);
        false
    }
}
// @lc code=end

/*
// @lcpr case=start
// [1,1,2,2,2]\n
// @lcpr case=end

// @lcpr case=start
// [3,3,3,3,4]\n
// @lcpr case=end

 */
