/*
 * @lc app=leetcode.cn id=LCR 082 lang=rust
 * @lcpr version=30304
 *
 * [LCR 082] 组合总和 II
 */

// @lc code=start
impl Solution {
    pub fn combination_sum2(candidates: Vec<i32>, target: i32) -> Vec<Vec<i32>> {
        let mut res = Vec::new();
        let mut path = Vec::new();
        let mut candidates = candidates;
        candidates.sort_unstable();
        Self::backtrack(&candidates, &mut res, &mut path, 0, target);
        res
    }

    fn backtrack(
        candidates: &[i32],
        res: &mut Vec<Vec<i32>>,
        path: &mut Vec<i32>,
        start: usize,
        target: i32,
    ) {
        if target == 0 {
            res.push(path.clone());
            return;
        }

        if target < 0 {
            return;
        }

        for i in start..candidates.len() {
            if i > start && candidates[i] == candidates[i - 1] {
                continue;
            }

            if candidates[i] > target {
                break;
            }

            path.push(candidates[i]);
            Self::backtrack(candidates, res, path, i + 1, target - candidates[i]); // Explore
            path.pop();
        }
    }
}

// @lc code=end

/*
// @lcpr case=start
// [10,1,2,7,6,1,5]\n8\n
// @lcpr case=end

// @lcpr case=start
// [2,5,2,1,2]\n5\n
// @lcpr case=end

 */
