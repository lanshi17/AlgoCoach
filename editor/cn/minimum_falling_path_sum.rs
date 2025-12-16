/*
 * @lc app=leetcode.cn id=931 lang=rust
 * @lcpr version=30305
 *
 * [931] 下降路径最小和
 */

// @lc code=start
use std::i32;
impl Solution {
    pub fn min_falling_path_sum(matrix: Vec<Vec<i32>>) -> i32 {
        let n = matrix.len();
        if n == 0 {
            return 0;
        }
        let mut memo: Vec<Vec<Option<i32>>> = vec![vec![None; n]; n];
        let mut res = i32::MAX;
        for j in 0..n {
            let path_num = Self::dp(&matrix, n - 1, j, &mut memo);
            res = res.min(path_num);
        }
        res
    }
    fn dp(matrix: &Vec<Vec<i32>>, i: usize, j: usize, memo: &mut Vec<Vec<Option<i32>>>) -> i32 {
        if j >= matrix[0].len() {
            return i32::MAX;
        }
        if i == 0 {
            return matrix[0][j];
        }
        if let Some(val) = memo[i][j] {
            return val;
        }
        let up = Self::dp(matrix, i - 1, j, memo);
        let up_left = if j > 0 {
            Self::dp(matrix, i - 1, j - 1, memo)
        } else {
            i32::MAX
        };
        let up_right = if j < matrix.len() - 1 {
            Self::dp(matrix, i - 1, j + 1, memo)
        } else {
            i32::MAX
        };
        let min_prev = up.min(up_left).min(up_right);
        let res = matrix[i][j] + min_prev;
        memo[i][j] = Some(res);
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[2,1,3],[6,5,4],[7,8,9]]\n
// @lcpr case=end

// @lcpr case=start
// [[-19,57],[-40,-5]]\n
// @lcpr case=end

 */
