/*
 * @lc app=leetcode.cn id=3212 lang=rust
 * @lcpr version=30400
 *
 * [3212] 统计 X 和 Y 频数相等的子矩阵数量
 */

// @lc code=start
impl Solution {
    pub fn number_of_submatrices(grid: Vec<Vec<char>>) -> i32 {
        let m = grid.len();
        if m == 0 {
            return 0;
        }
        let n = grid[0].len();
        if n == 0 {
            return 0;
        }

        // col_diff[j] = D(i-1, j), col_x[j] = X(i-1, j)
        let mut col_diff = vec![0i32; n];
        let mut col_x = vec![0i32; n];

        let mut ans: i32 = 0;

        for row in grid.iter() {
            let mut row_diff = 0i32;
            let mut row_x = 0i32;

            for (j, &ch) in row.iter().enumerate() {
                match ch {
                    'X' => {
                        row_diff += 1;
                        row_x += 1;
                    }
                    'Y' => {
                        row_diff -= 1;
                    }
                    _ => {}
                }

                let diff = col_diff[j] + row_diff;
                let x = col_x[j] + row_x;

                col_diff[j] = diff;
                col_x[j] = x;

                if diff == 0 && x > 0 {
                    ans += 1;
                }
            }
        }

        ans
    }
}
// @lc code=end

/*
// @lcpr case=start
// [["X","Y","."],["Y",".","."]]\n
// @lcpr case=end

// @lcpr case=start
// [["X","X"],["X","Y"]]\n
// @lcpr case=end

// @lcpr case=start
// [[".","."],[".","."]]\n
// @lcpr case=end

 */
