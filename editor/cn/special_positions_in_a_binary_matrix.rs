/*
 * @lc app=leetcode.cn id=1582 lang=rust
 * @lcpr version=30400
 *
 * [1582] 二进制矩阵中的特殊位置
 */

// @lc code=start
impl Solution {
    pub fn num_special(mat: Vec<Vec<i32>>) -> i32 {
        let rows = mat.len();
        let cols = mat[0].len();
        let rows_count: Vec<i32> = mat.iter().map(|row| row.iter().sum()).collect();
        let cols_count: Vec<i32> = (0..cols)
            .map(|j| mat.iter().map(|row| row[j]).sum())
            .collect();
        mat.iter()
            .enumerate()
            .flat_map(|(i, row)| row.iter().enumerate().map(move |(j, &val)| (i, j, val)))
            .filter(|&(i, j, val)| val == 1 && rows_count[i] == 1 && cols_count[j] == 1)
            .count() as i32
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[1,0,0],[0,0,1],[1,0,0]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,0,0],[0,1,0],[0,0,1]]\n
// @lcpr case=end

 */
