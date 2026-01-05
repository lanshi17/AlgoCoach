/*
 * @lc app=leetcode.cn id=2140 lang=rust
 * @lcpr version=30305
 *
 * [2140] 解决智力问题
 */

// @lc code=start
use std::cmp::max;
impl Solution {
    /// 计算做题能获得的最大分数
    ///
    /// 给定一个二维数组 questions，其中 questions[i] = [points_i, brainpower_i]，
    /// 可以选择做或跳过题目。做第 i 题获得 points_i 分，但接下来 brainpower_i 道题不能做。
    /// 求可以获得的最大得分。
    ///
    /// # 参数
    /// * `questions` - 二维数组，每个子数组包含 [分数, 脑力值(跳过题数)]
    ///
    /// # 返回值
    /// 返回可以获得的最大分数
    pub fn most_points(questions: Vec<Vec<i32>>) -> i64 {
        let n = questions.len();
        if n == 0 {
            return 0;
        }
        let questions: Vec<(i64, usize)> = questions
            .into_iter()
            .map(|q| (q[0] as i64, q[1] as usize))
            .collect();
        let mut dp = vec![0i64; n + 1];
        for i in (0..n).rev() {
            let (points, skip_count) = questions[i];
            let next_after_solve = i + skip_count + 1;
            let points_from_solve = points + dp.get(next_after_solve).copied().unwrap_or(0);
            let points_skip_solve = dp[i + 1];
            dp[i] = max(points_from_solve, points_skip_solve);
        }
        dp[0]
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[3,2],[4,3],[4,4],[2,5]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,1],[2,2],[3,3],[4,4],[5,5]]\n
// @lcpr case=end

 */
