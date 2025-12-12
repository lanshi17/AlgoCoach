/*
 * @lc app=leetcode.cn id=542 lang=rust
 * @lcpr version=30304
 *
 * [542] 01 矩阵
 */

// @lc code=start
use std::collections::VecDeque;
const DIRS: [[i32; 2]; 4] = [[0, 1], [0, -1], [1, 0], [-1, 0]];
impl Solution {
    pub fn update_matrix(mat: Vec<Vec<i32>>) -> Vec<Vec<i32>> {
        let m = mat.len();
        let n = mat[0].len();
        let mut res = vec![vec![-1; n]; m];
        let mut queue: VecDeque<(i32, i32)> = VecDeque::new();
        for i in 0..m {
            for j in 0..n {
                if mat[i][j] == 0 {
                    queue.push_back((i as i32, j as i32));
                    res[i][j] = 0;
                }
            }
        }
        while !queue.is_empty() {
            let cur_level_size = queue.len();
            for _ in 0..cur_level_size {
                if let Some((x, y)) = queue.pop_front() {
                    for &[dr, dc] in &DIRS {
                        let next_row = x + dr;
                        let next_col = y + dc;
                        if next_row >= 0
                            && next_row < m as i32
                            && next_col >= 0
                            && next_col < n as i32
                            && res[next_row as usize][next_col as usize] == -1
                        {
                            queue.push_back((next_row, next_col));
                            res[next_row as usize][next_col as usize] =
                                res[x as usize][y as usize] + 1;
                        }
                    }
                }
            }
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[0,0,0],[0,1,0],[0,0,0]]\n
// @lcpr case=end

// @lcpr case=start
// [[0,0,0],[0,1,0],[1,1,1]]\n
// @lcpr case=end

 */
