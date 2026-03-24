/*
 * @lc app=leetcode.cn id=1594 lang=rust
 * @lcpr version=30401
 *
 * [1594] 矩阵的最大非负积
 */

// @lc code=start
impl Solution {
    pub fn max_product_path(grid: Vec<Vec<i32>>) -> i32 {
        let m = grid.len();
        let n = grid[0].len();
        let mut max_dp = vec![vec![0i128; n]; m];
        let mut min_dp = vec![vec![0i128; n]; m];

        max_dp[0][0] = grid[0][0] as i128;
        min_dp[0][0] = grid[0][0] as i128;

        for i in 0..m {
            for j in 0..n {
                if i == 0 && j == 0 {
                    continue;
                }
                let v = grid[i][j] as i128;
                let mut max_val = i128::MIN;
                let mut min_val = i128::MAX;

                if i > 0 {
                    let a = max_dp[i - 1][j] * v;
                    let b = min_dp[i - 1][j] * v;
                    max_val = max_val.max(a.max(b));
                    min_val = min_val.min(a.min(b));
                }
                if j > 0 {
                    let a = max_dp[i][j - 1] * v;
                    let b = min_dp[i][j - 1] * v;
                    max_val = max_val.max(a.max(b));
                    min_val = min_val.min(a.min(b));
                }

                max_dp[i][j] = max_val;
                min_dp[i][j] = min_val;
            }
        }

        let res = max_dp[m - 1][n - 1];
        if res < 0 {
            -1
        } else {
            const MOD: i128 = 1_000_000_007;
            (res % MOD) as i32
        }
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[-1,-2,-3],[-2,-3,-3],[-3,-3,-2]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,-2,1],[1,-2,1],[3,-4,1]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,3],[0,-4]]\n
// @lcpr case=end

 */
