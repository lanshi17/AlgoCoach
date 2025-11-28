/*
 * @lc app=leetcode.cn id=491 lang=rust
 * @lcpr version=30304
 *
 * [491] 非递减子序列
 */

// @lc code=start
use std::collections::HashSet;

impl Solution {
    pub fn find_subsequences(nums: Vec<i32>) -> Vec<Vec<i32>> {
        let mut solution = FindSubsequences::new();
        solution.backtrack(&nums, 0);
        solution.res
    }
}

struct FindSubsequences {
    res: Vec<Vec<i32>>,
    track: Vec<i32>,
}

impl FindSubsequences {
    fn new() -> Self {
        Self {
            res: Vec::new(),
            track: Vec::new(),
        }
    }

    fn backtrack(&mut self, nums: &Vec<i32>, start: usize) {
        // 如果路径长度大于等于2，找到一个合法答案
        if self.track.len() >= 2 {
            self.res.push(self.track.clone());
        }

        // 用哈希集合防止重复选择相同元素
        let mut used = HashSet::new();

        // 回溯算法标准框架
        for i in start..nums.len() {
            // 保证集合中元素都是递增顺序
            if !self.track.is_empty() && self.track.last().unwrap() > &nums[i] {
                continue;
            }

            // 保证不要重复使用相同的元素
            if used.contains(&nums[i]) {
                continue;
            }

            // 选择 nums[i]
            used.insert(nums[i]);
            self.track.push(nums[i]);

            // 递归遍历下一层回溯树
            self.backtrack(nums, i + 1);

            // 撤销选择 nums[i]
            self.track.pop();
        }
    }
}

// @lc code=end

/*
// @lcpr case=start
// [4,6,7,7]\n
// @lcpr case=end

// @lcpr case=start
// [4,4,3,2,1]\n
// @lcpr case=end

 */
