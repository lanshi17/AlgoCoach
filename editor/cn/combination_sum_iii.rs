/*
 * @lc app=leetcode.cn id=216 lang=rust
 * @lcpr version=30304
 *
 * [216] 组合总和 III
 */

// @lc code=start
impl Solution {
    pub fn combination_sum3(k: i32, n: i32) -> Vec<Vec<i32>> {
        let mut res = Vec::new();
        let mut path = Vec::new();
        Self::backtrack(k, n, 1, &mut path, &mut res);
        res
    }
    fn backtrack(
        k: i32,                  // 还需要选择的数字个数
        target: i32,             // 剩余的目标和
        start: i32,              // 开始选择的数字
        path: &mut Vec<i32>,     // 当前路径
        res: &mut Vec<Vec<i32>>, // 结果集
    ) {
        // 基础情况：找到符合条件的组合
        if k == 0 && target == 0 {
            res.push(path.clone());
            return;
        }

        // 剪枝：如果已经没有数字可选或目标和已超
        if k == 0 || target <= 0 {
            return;
        }

        // 优化剪枝：检查剩余数字是否足够
        if start > 9 {
            return;
        }

        // 进一步优化：计算当前可选数字的最小和和最大和
        // 最小和：start + (start+1) + ... + (start+k-1)
        let max_sum = (0..k).map(|i| 9 - i).sum::<i32>();
        let min_sum = (0..k).map(|i| start + i).sum::<i32>();
        // 最大和：9 + 8 + ... + (9-k+1)

        if target > max_sum || target < min_sum {
            return;
        }

        // 回溯框架：从start开始选择数字
        for i in start..=9 {
            // 剪枝：如果当前数字就超过剩余目标和，后面的也不用看了
            if start > target {
                break;
            }

            // 做选择
            path.push(i);

            // 递归：还需要选择k-1个数，目标和减少i，从i+1开始选择
            Self::backtrack(k - 1, target - i, i + 1, path, res);
            // 撤销选择
            path.pop();
        }
    }
}
// @lc code=end

/*
// @lcpr case=start
// 3\n7\n
// @lcpr case=end

// @lcpr case=start
// 3\n9\n
// @lcpr case=end

// @lcpr case=start
// 4\n1\n
// @lcpr case=end

 */
