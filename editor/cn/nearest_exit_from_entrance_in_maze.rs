/*
 * @lc app=leetcode.cn id=1926 lang=rust
 * @lcpr version=30304
 *
 * [1926] 迷宫中离入口最近的出口
 */

// @lc code=start
use std::collections::VecDeque;
const DIRS: [[i32; 2]; 4] = [[0, 1], [0, -1], [1, 0], [-1, 0]];
impl Solution {
    pub fn nearest_exit(maze: Vec<Vec<char>>, entrance: Vec<i32>) -> i32 {
        let m = maze.len();
        let n = maze[0].len();
        let mut visited: Vec<Vec<bool>> = vec![vec![false; n]; m];
        let mut queue: VecDeque<(usize, usize)> = VecDeque::new();
        let start_row = entrance[0] as usize;
        let start_col = entrance[1] as usize;
        queue.push_back((start_row, start_col));
        visited[start_row][start_col] = true;
        let mut steps = 0;
        while !queue.is_empty() {
            let current_level_size = queue.len();
            for _ in 0..current_level_size {
                if let Some((current_row, current_col)) = queue.pop_front() {
                    for &[dr, dc] in &DIRS {
                        let new_row = current_row as i32 + dr;
                        let new_col = current_col as i32 + dc;
                        if new_row >= 0 && new_row < m as i32 && new_col >= 0 && new_col < n as i32
                        {
                            let nr = new_row as usize;
                            let nc = new_col as usize;
                            if !visited[nr][nc] && maze[nr][nc] == '.' {
                                if nr == 0 || nr == m - 1 || nc == 0 || nc == n - 1 {
                                    return steps + 1;
                                }
                                visited[nr][nc] = true;
                                queue.push_back((nr, nc));
                            }
                        }
                    }
                }
            }
            steps += 1;
        }
        -1
    }
}
// @lc code=end

/*
// @lcpr case=start
// [["+","+",".","+"],[".",".",".","+"],["+","+","+","."]]\n[1,2]\n
// @lcpr case=end

// @lcpr case=start
// [["+","+","+"],[".",".","."],["+","+","+"]]\n[1,0]\n
// @lcpr case=end

// @lcpr case=start
// [[".","+"]]\n[0,0]\n
// @lcpr case=end

 */
