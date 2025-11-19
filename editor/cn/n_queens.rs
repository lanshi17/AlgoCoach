/*
 * @lc app=leetcode.cn id=51 lang=rust
 * @lcpr version=30304
 *
 * [51] N 皇后
 */

// @lc code=start
impl Solution {
    pub fn solve_n_queens(n: i32) -> Vec<Vec<String>> {
        let n = n as usize;
        let board = vec![vec!['.'; n]; n];
        let mut res = Vec::new();
        Self::backtrack(board, 0, &mut res);
        res
    }
    fn backtrack(mut board: Vec<Vec<char>>, row: usize, res: &mut Vec<Vec<String>>) {
        if row == board.len() {
            let solution: Vec<String> = board
                .iter()
                .map(|row_chars| row_chars.iter().collect())
                .collect();
            res.push(solution);
            return;
        }
        let n = board[row].len();
        for col in 0..n {
            if !Self::is_valid(&board, row, col) {
                continue;
            }
            board[row][col] = 'Q';
            Self::backtrack(board.clone(), row + 1, res);
            board[row][col] = '.';
        }
    }
    fn is_valid(board: &Vec<Vec<char>>, row: usize, col: usize) -> bool {
        let n = board.len();
        for i in 0..row {
            if board[i][col] == 'Q' {
                return false;
            }
        }
        let mut i = row as i32 - 1;
        let mut j = col + 1;
        while i >= 0 && j < n {
            if board[i as usize][j] == 'Q' {
                return false;
            }
            i -= 1;
            j += 1;
        }
        let mut i = row as i32 - 1;
        let mut j = col as i32 - 1;
        while i >= 0 && j >= 0 {
            if board[i as usize][j as usize] == 'Q' {
                return false;
            }
            i -= 1;
            j -= 1;
        }
        true
    }
}
// @lc code=end

/*
// @lcpr case=start
// 4\n
// @lcpr case=end

// @lcpr case=start
// 1\n
// @lcpr case=end

 */
