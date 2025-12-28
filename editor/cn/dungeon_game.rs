/*
 * @lc app=leetcode.cn id=174 lang=rust
 * @lcpr version=30305
 *
 * [174] 地下城游戏
 */

// @lc code=start
impl Solution {
    /// 计算确保骑士能够拯救到公主所需的最低初始健康点数。
    ///
    /// 使用动态规划，从右下角（公主位置）开始反向推导。
    ///
    /// # Arguments
    /// * `dungeon`: 表示地下城的二维网格，其中负数表示损失健康，正数表示增加健康。
    ///
    /// # Returns
    /// 返回所需的最低初始健康点数。
    pub fn calculate_minimum_hp(dungeon: Vec<Vec<i32>>) -> i32 {
        if dungeon.is_empty() || dungeon[0].is_empty() {
            return 1; // 空网格，初始健康点数至少为 1
        }

        let m = dungeon.len();
        let n = dungeon[0].len();

        // dp[i][j] 表示从 (i, j) 到达终点所需的最低初始健康点数
        let mut dp = vec![vec![0; n]; m];

        // 初始化右下角（公主位置）
        // 骑士到达 (m-1, n-1) 后，其健康点数减去 dungeon[m-1][n-1] 的值必须至少为 1
        // 所以进入 (m-1, n-1) 之前，健康点数至少为 max(1, 1 - dungeon[m-1][n-1])
        dp[m - 1][n - 1] = (1 - dungeon[m - 1][n - 1]).max(1);

        // 初始化最后一行（只能从右边来）
        for j in (0..n - 1).rev() {
            // 从 (m-1, j+1) 所需的健康点数，减去当前房间的值，保证结果至少为 1
            dp[m - 1][j] = (dp[m - 1][j + 1] - dungeon[m - 1][j]).max(1);
        }

        // 初始化最后一列（只能从下边来）
        for i in (0..m - 1).rev() {
            // 从 (i+1, n-1) 所需的健康点数，减去当前房间的值，保证结果至少为 1
            dp[i][n - 1] = (dp[i + 1][n - 1] - dungeon[i][n - 1]).max(1);
        }

        // 填充 dp 表的其余部分（从右下往左上）
        for i in (0..m - 1).rev() {
            for j in (0..n - 1).rev() {
                // 选择从右边或下边到达终点所需健康点数较少的那个
                let min_health_from_next = dp[i + 1][j].min(dp[i][j + 1]);
                // 从当前位置 (i, j) 到达下一个位置所需的初始健康点数
                // 该健康点数必须至少为 1
                dp[i][j] = (min_health_from_next - dungeon[i][j]).max(1);
            }
        }

        // 返回从左上角出发所需的最低初始健康点数
        dp[0][0]
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[-2,-3,3],[-5,-10,1],[10,30,-5]]\n
// @lcpr case=end

// @lcpr case=start
// [[0]]\n
// @lcpr case=end

 */
