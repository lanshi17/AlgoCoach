/*
 * @lc app=leetcode.cn id=37 lang=rust
 * @lcpr version=30304
 *
 * [37] 解数独
 */

// @lc code=start
impl Solution {
    pub fn solve_sudoku(board: &mut Vec<Vec<char>>) {
        Self::backtrack(board, 0, 0);
    }

    // 返回 bool 表示是否找到解
    fn backtrack(board: &mut Vec<Vec<char>>, row: usize, col: usize) -> bool {
        // 移动到下一行
        if col == 9 {
            return Self::backtrack(board, row + 1, 0);
        }

        // 所有行都处理完，找到解
        if row == 9 {
            return true;
        }

        // 当前格子已填数字，跳到下一格
        if board[row][col] != '.' {
            return Self::backtrack(board, row, col + 1);
        }

        // 尝试填入 1-9
        for ch in '1'..='9' {
            if !Self::is_valid(board, row, col, ch) {
                continue;
            }

            board[row][col] = ch;

            // 递归尝试下一个位置
            if Self::backtrack(board, row, col + 1) {
                return true; // 找到解就立即返回
            }

            // 回溯：撤销选择
            board[row][col] = '.';
        }

        false // 穷举完仍未找到解
    }

    fn is_valid(board: &Vec<Vec<char>>, row: usize, col: usize, num: char) -> bool {
        for i in 0..9 {
            // 检查行
            if board[row][i] == num {
                return false;
            }
            // 检查列
            if board[i][col] == num {
                return false;
            }
            // 检查3x3宫格
            let box_row = (row / 3) * 3 + i / 3;
            let box_col = (col / 3) * 3 + i % 3;
            if board[box_row][box_col] == num {
                return false;
            }
        }
        true
    }
}
// @lc code=end

/*
// @lcpr case=start
// [["5","3",".",".","7",".",".",".","."],["6",".",".","1","9","5",".",".","."],[".","9","8",".",".",".",".","6","."],["8",".",".",".","6",".",".",".","3"],["4",".",".","8",".","3",".",".","1"],["7",".",".",".","2",".",".",".","6"],[".","6",".",".",".",".","2","8","."],[".",".",".","4","1","9",".",".","5"],[".",".",".",".","8",".",".","7","9"]]\n
// @lcpr case=end

 */
