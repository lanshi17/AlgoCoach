/*
 * @lc app=leetcode.cn id=52 lang=rust
 * @lcpr version=30304
 *
 * [52] N 皇后 II
 */

// @lc code=start
impl Solution {
    /// 计算 n 皇后问题的不同解决方案数量
    ///
    /// N 皇后问题要求在 n×n 的棋盘上放置 n 个皇后，
    /// 使得任何两个皇后都不能在同一行、同一列或同一对角线上。
    ///
    /// # 参数
    /// * `n` - 棋盘大小和皇后的数量
    ///
    /// # 返回值
    /// 返回满足条件的解决方案总数
    pub fn total_n_queens(n: i32) -> i32 {
        // TODO: 初始化解决方案计数器
        let mut count = 0;

        // TODO: 创建表示棋盘状态的数据结构
        // 可以使用一维数组，索引代表行，值代表列位置
        let mut board = vec![0; n as usize];

        // TODO: 调用回溯函数开始搜索
        Self::backtrack(&mut board, 0_usize, &mut count);

        // TODO: 返回最终的解决方案数量
        count
    }

    /// 回溯算法核心函数
    ///
    /// 逐行尝试放置皇后，在每一行选择一个合适的位置，
    /// 如果当前位置与之前放置的皇后冲突则跳过，
    /// 否则继续在下一行放置皇后。
    ///
    /// # 参数
    /// * `board` - 当前棋盘状态
    /// * `row` - 当前正在处理的行
    /// * `count` - 用于累计解决方案数量的可变引用
    fn backtrack(board: &mut Vec<i32>, row: usize, count: &mut i32) {
        // TODO: 确定递归终止条件
        // 当所有行都成功放置皇后时，找到一个解决方案
        if row == board.len() {
            *count += 1;
            return;
        }
        // TODO: 遍历当前行的所有列位置
        for col in 0..board.len() {
            // TODO: 检查当前位置是否与已放置的皇后冲突

            // TODO: 如果不冲突，放置皇后并递归处理下一行
            // TODO: 递归返回后进行回溯（撤销当前行的皇后放置）
            if !Self::is_conflict(board, row, col) {
                board[row] = col as i32;
                Self::backtrack(board, row + 1, count);
            }
        }
    }

    /// 冲突检测函数
    ///
    /// 检查在指定位置放置皇后是否会与之前放置的皇后冲突。
    /// 冲突包括：同列、主对角线、副对角线冲突。
    ///
    /// # 参数
    /// * `board` - 当前棋盘状态
    /// * `row` - 当前要放置皇后的行
    /// * `col` - 当前要放置皇后的列
    ///
    /// # 返回值
    /// 如果冲突返回 true，否则返回 false
    fn is_conflict(board: &mut Vec<i32>, row: usize, col: usize) -> bool {
        // TODO: 遍历之前已放置皇后的所有行
        for i in 0..row {
            if board[i] as usize == col {
                return true;
            }
            if (board[i] as usize).abs_diff(col) == i.abs_diff(row) {
                return true;
            }
            if ((board[i] as usize) - col) == (i - row) {
                return true;
            }
        }
        false
        // TODO: 检查同列冲突（列号相同）

        // TODO: 检查主对角线冲突（行差绝对值等于列差绝对值）

        // TODO: 检查副对角线冲突（行差等于列差）
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
