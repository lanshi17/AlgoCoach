/*
 * @lc app=leetcode.cn id=3643 lang=rust
 * @lcpr version=30400
 *
 * [3643] 垂直翻转子矩阵
 */

// @lc code=start
impl Solution {
    pub fn reverse_submatrix(mut grid: Vec<Vec<i32>>, x: i32, y: i32, k: i32) -> Vec<Vec<i32>> {
        let x = x as usize;
        let y = y as usize;
        let k = k as usize;

        for r in 0..(k / 2) {
            let top = x + r;
            let bottom = x + k - 1 - r;

            // split_at_mut 保证同时可变借用两行
            let (upper, lower) = grid.split_at_mut(bottom);
            let row_top = &mut upper[top][y..y + k];
            let row_bottom = &mut lower[0][y..y + k];

            row_top.swap_with_slice(row_bottom);
        }

        grid
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16]]\n1\n0\n3\n
// @lcpr case=end

// @lcpr case=start
// [[3,4,2,3],[2,3,4,2]]\n0\n2\n2\n
// @lcpr case=end

 */
