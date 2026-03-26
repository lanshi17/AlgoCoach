/*
 * @lc app=leetcode.cn id=3546 lang=rust
 * @lcpr version=30401
 *
 * [3546] 等和矩阵分割 I
 */

// @lc code=start
impl Solution {
    pub fn can_partition_grid(grid: Vec<Vec<i32>>) -> bool {
        let m = grid.len();
        let n = grid[0].len();

        let mut row_sum = vec![0_i64; m];
        let mut col_sum = vec![0_i64; n];
        let mut total = 0_i64;

        // 一次遍历：统计总和、每行和、每列和
        for i in 0..m {
            for j in 0..n {
                let v = grid[i][j] as i64;
                total += v;
                row_sum[i] += v;
                col_sum[j] += v;
            }
        }

        // 总和为奇数，不可能平分
        if (total & 1) == 1 {
            return false;
        }
        let target = total / 2;

        // 检查水平切分：切在 i 和 i+1 之间 => i 只能到 m-2
        let mut pref = 0_i64;
        for i in 0..m.saturating_sub(1) {
            pref += row_sum[i];
            if pref == target {
                return true;
            }
            if pref > target {
                break; // 正整数保证后面只会更大
            }
        }

        // 检查垂直切分：切在 j 和 j+1 之间 => j 只能到 n-2
        pref = 0;
        for j in 0..n.saturating_sub(1) {
            pref += col_sum[j];
            if pref == target {
                return true;
            }
            if pref > target {
                break;
            }
        }

        false
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[1,4],[2,3]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,3],[2,4]]\n
// @lcpr case=end

 */
