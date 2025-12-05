/*
 * @lc app=leetcode.cn id=2850 lang=rust
 * @lcpr version=30304
 *
 * [2850] 将石头分散到网格图的最少移动次数
 */

// @lc code=start
impl Solution {
    pub fn minimum_moves(mut grid: Vec<Vec<i32>>) -> i32 {
        let mut redundant = Vec::new();
        let mut empty = Vec::new();

        let m = grid.len();
        let n = grid[0].len();

        // 收集多余石子的位置和空位置
        for i in 0..m {
            for j in 0..n {
                if grid[i][j] > 1 {
                    redundant.push((i, j));
                } else if grid[i][j] == 0 {
                    empty.push((i, j));
                }
            }
        }

        let mut min_move = i32::MAX;
        let mut current_move = 0;

        Self::backtrack(&mut grid, &redundant, &empty, &mut min_move, &mut current_move);

        min_move
    }
    fn backtrack(
        grid: &mut Vec<Vec<i32>>,
        redundant: &[(usize, usize)],
        empty: &[(usize, usize)],
        min_move: &mut i32,
        current_move: &mut i32,
    ) {
        let empty_count = empty.iter().filter(|&&(i, j)| grid[i][j] == 0).count();
        if empty_count == 0 {
            *min_move = (*min_move).min(*current_move);
            return;
        }
        for &(src_x, src_y) in redundant {
            if grid[src_x][src_y] == 1 {
                continue;
            }
            for &(dest_x, dest_y) in empty {
                if grid[dest_x][dest_y] != 0 {
                    continue;
                }
                let step =
                    (src_x as i32 - dest_x as i32).abs() + (src_y as i32 - dest_y as i32).abs();
                grid[dest_x][dest_y] = 1;
                grid[src_x][src_y] -= 1;
                *current_move += step;
                Self::backtrack(grid, redundant, empty, min_move, current_move);
                grid[dest_x][dest_y] = 0;
                grid[src_x][src_y] += 1;
                *current_move -= step;
            }
        }
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[1,1,0],[1,1,1],[1,2,1]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,3,0],[1,0,0],[1,0,3]]\n
// @lcpr case=end

 */
