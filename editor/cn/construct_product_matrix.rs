/*
 * @lc app=leetcode.cn id=2906 lang=rust
 * @lcpr version=30401
 *
 * [2906] 构造乘积矩阵
 */

// @lc code=start
impl Solution {
    pub fn construct_product_matrix(grid: Vec<Vec<i32>>) -> Vec<Vec<i32>> {
        const MOD: i64 = 12_345;

        let n = grid.len();
        let m = grid[0].len();
        let mut ans = vec![vec![0i32; m]; n];

        // 1) 正向：ans[i][j] 先放“前缀乘积”
        let mut prefix = 1i64;
        for i in 0..n {
            for j in 0..m {
                ans[i][j] = prefix as i32;
                prefix = (prefix * (grid[i][j] as i64 % MOD)) % MOD;
            }
        }

        // 2) 反向：乘上“后缀乘积”
        let mut suffix = 1i64;
        for i in (0..n).rev() {
            for j in (0..m).rev() {
                ans[i][j] = ((ans[i][j] as i64 * suffix) % MOD) as i32;
                suffix = (suffix * (grid[i][j] as i64 % MOD)) % MOD;
            }
        }

        ans
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[1,2],[3,4]]\n
// @lcpr case=end

// @lcpr case=start
// [[12345],[2],[1]]\n
// @lcpr case=end

 */
