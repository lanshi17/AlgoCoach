/*
 * @lc app=leetcode.cn id=79 lang=rust
 * @lcpr version=30304
 *
 * [79] 单词搜索
 */

// @lc code=start
impl Solution {
    pub fn exist(board: Vec<Vec<char>>, word: String) -> bool {
        if board.is_empty() || board[0].is_empty() || word.is_empty() {
            return false;
        }

        let m = board.len();
        let n = board[0].len();
        let word_chars: Vec<char> = word.chars().collect();
        let mut visited = vec![vec![false; n]; m];

        for i in 0..m {
            for j in 0..n {
                if Self::dfs(&board, &mut visited, i, j, &word_chars, 0) {
                    return true;
                }
            }
        }
        false
    }

    fn dfs(
        board: &Vec<Vec<char>>,
        visited: &mut Vec<Vec<bool>>,
        i: usize,
        j: usize,
        word: &[char],
        p: usize,
    ) -> bool {
        // 基本边界检查
        if i >= board.len() || j >= board[0].len() || visited[i][j] || board[i][j] != word[p] {
            return false;
        }

        // 如果到达单词末尾，成功
        if p == word.len() - 1 {
            return true;
        }

        // 标记当前位置已访问
        visited[i][j] = true;

        // 向四个方向探索
        let directions = [(0, 1), (1, 0), (0, -1), (-1, 0)];
        for &(di, dj) in &directions {
            let next_i = i as i32 + di;
            let next_j = j as i32 + dj;

            if next_i >= 0
                && next_j >= 0
                && (next_i as usize) < board.len()
                && (next_j as usize) < board[0].len()
            {
                if Self::dfs(board, visited, next_i as usize, next_j as usize, word, p + 1) {
                    visited[i][j] = false; // 回溯
                    return true;
                }
            }
        }

        // 回溯
        visited[i][j] = false;
        false
    }
}
// @lc code=end

/*
// @lcpr case=start
// [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]]\n"ABCCED"\n
// @lcpr case=end

// @lcpr case=start
// [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]]\n"SEE"\n
// @lcpr case=end

// @lcpr case=start
// [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]]\n"ABCB"\n
// @lcpr case=end

 */
