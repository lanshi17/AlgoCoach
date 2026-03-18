/*
 * @lc app=leetcode.cn id=3070 lang=rust
 * @lcpr version=30400
 *
 * [3070] 元素和小于等于 k 的子矩阵的数目
 */

// @lc code=start
impl Solution {
    pub fn count_submatrices(grid: Vec<Vec<i32>>, k: i32) -> i32 {
        let m = grid.len();
        let n = grid[0].len();

        let mut col_sum = vec![0i64; n];
        let mut ans: i64 = 0;
        let k = k as i64;

        for row in grid.iter() {
            let mut row_prefix: i64 = 0;
            for (j, &val) in row.iter().enumerate() {
                row_prefix += val as i64;
                let s = col_sum[j] + row_prefix; // S(i,j)
                col_sum[j] = s;

                if s <= k {
                    ans += 1;
                }
            }
        }

        ans as i32
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[7,6,3],[6,6,1]]\n18\n
// @lcpr case=end

// @lcpr case=start
// [[7,2,9],[1,5,0],[2,6,6]]\n20\n
// @lcpr case=end

 */
