/*
 * @lc app=leetcode.cn id=LCR 084 lang=rust
 * @lcpr version=30304
 *
 * [LCR 084] 全排列 II
 */

// @lc code=start
impl Solution {
    pub fn permute_unique(nums: Vec<i32>) -> Vec<Vec<i32>> {
        let mut nums = nums;
        nums.sort();
        let mut used = vec![false; nums.len()];
        let mut track = vec![];
        let mut res = vec![];

        Self::backtrack(&nums, &mut used, &mut track, &mut res);
        res
    }

    fn backtrack(
        nums: &Vec<i32>,
        used: &mut Vec<bool>,
        track: &mut Vec<i32>,
        res: &mut Vec<Vec<i32>>,
    ) {
        // 触发结束条件
        if track.len() == nums.len() {
            res.push(track.clone());
            return;
        }

        for i in 0..nums.len() {
            // 排除不合法的选择
            if used[i] {
                continue;
            }

            // 剪枝逻辑：相同元素只能按顺序使用
            if i > 0 && nums[i] == nums[i - 1] && !used[i - 1] {
                continue;
            }

            // 做选择
            track.push(nums[i]);
            used[i] = true;

            // 进入下一层决策树
            Self::backtrack(nums, used, track, res);

            // 撤销选择
            track.pop();
            used[i] = false;
        }
    }
}

// @lc code=end

/*
// @lcpr case=start
// [1,1,2]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3]\n
// @lcpr case=end

 */
