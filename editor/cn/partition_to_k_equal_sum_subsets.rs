/*
 * @lc app=leetcode.cn id=698 lang=rust
 * @lcpr version=30304
 *
 * [698] 划分为k个相等的子集
 */

// @lc code=start
use std::collections::HashMap;
impl Solution {
    pub fn can_partition_k_subsets(nums: Vec<i32>, k: i32) -> bool {
        if k > nums.len() as i32 {
            return false;
        }
        let sum: i32 = nums.iter().sum();
        if sum % k != 0 {
            return false;
        }
        let mut memo: HashMap<i32, bool> = HashMap::new();
        let mut target = sum / k;
        Self::backtrack(k, 0, &nums, 0, 0, target, &mut memo)
    }
    fn backtrack(
        k: i32,
        bucket: i32,
        nums: &Vec<i32>,
        start: usize,
        used: i32,
        target: i32,
        memo: &mut HashMap<i32, bool>,
    ) -> bool {
        if k == 0 {
            return true;
        }
        if bucket == target {
            let res = Self::backtrack(k - 1, 0, nums, 0, used, target, memo);
            memo.insert(used, res);
            return res;
        }
        if let Some(&res) = memo.get(&used) {
            return res;
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
            if Self::backtrack(k, new_bucket, nums, i + 1, new_used, target, memo) {
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
// [4,3,2,3,5,2,1]\n4\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3,4]\n3\n
// @lcpr case=end

 */
