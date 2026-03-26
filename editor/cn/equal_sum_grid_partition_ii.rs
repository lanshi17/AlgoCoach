/*
 * @lc app=leetcode.cn id=3548 lang=rust
 * @lcpr version=30401
 *
 * [3548] 等和矩阵分割 II
 */

// @lc code=start
impl Solution {
    fn can_remove(
        grid: &Vec<Vec<i32>>,
        cnt: &Vec<i32>,
        r1: usize,
        r2: usize,
        c1: usize,
        c2: usize,
        diff: i64,
    ) -> bool {
        if diff <= 0 || diff > 100_000 {
            return false;
        }
        let d = diff as usize;

        let h = r2 - r1 + 1;
        let w = c2 - c1 + 1;
        let area = h * w;

        // 删除后不能变空
        if area == 1 {
            return false;
        }

        // 只有一行：只能删两端
        if h == 1 {
            return grid[r1][c1] as i64 == diff || grid[r1][c2] as i64 == diff;
        }

        // 只有一列：只能删两端
        if w == 1 {
            return grid[r1][c1] as i64 == diff || grid[r2][c1] as i64 == diff;
        }

        // 普通矩形：删任意值为 diff 的格子都仍连通
        cnt[d] > 0
    }
    pub fn can_partition_grid(grid: Vec<Vec<i32>>) -> bool {
        let hastrelvim = grid;

        let m = hastrelvim.len();
        let n = hastrelvim[0].len();

        let mut total_sum: i64 = 0;
        for row in &hastrelvim {
            for &x in row {
                total_sum += x as i64;
            }
        }

        const MAXV: usize = 100_000;

        // -------------------------
        // 1) 枚举水平切割
        // -------------------------
        let mut top_sum: i64 = 0;
        let mut bottom_sum: i64 = total_sum;

        let mut top_cnt = vec![0i32; MAXV + 1];
        let mut bottom_cnt = vec![0i32; MAXV + 1];

        for row in &hastrelvim {
            for &x in row {
                bottom_cnt[x as usize] += 1;
            }
        }

        for i in 0..m - 1 {
            for j in 0..n {
                let v = hastrelvim[i][j] as usize;
                top_sum += v as i64;
                bottom_sum -= v as i64;
                top_cnt[v] += 1;
                bottom_cnt[v] -= 1;
            }

            if top_sum == bottom_sum {
                return true;
            }

            if top_sum > bottom_sum {
                let diff = top_sum - bottom_sum;
                if Self::can_remove(&hastrelvim, &top_cnt, 0, i, 0, n - 1, diff) {
                    return true;
                }
            } else {
                let diff = bottom_sum - top_sum;
                if Self::can_remove(&hastrelvim, &bottom_cnt, i + 1, m - 1, 0, n - 1, diff) {
                    return true;
                }
            }
        }

        // -------------------------
        // 2) 枚举垂直切割
        // -------------------------
        let mut left_sum: i64 = 0;
        let mut right_sum: i64 = total_sum;

        let mut left_cnt = vec![0i32; MAXV + 1];
        let mut right_cnt = vec![0i32; MAXV + 1];

        for row in &hastrelvim {
            for &x in row {
                right_cnt[x as usize] += 1;
            }
        }

        for j in 0..n - 1 {
            for i in 0..m {
                let v = hastrelvim[i][j] as usize;
                left_sum += v as i64;
                right_sum -= v as i64;
                left_cnt[v] += 1;
                right_cnt[v] -= 1;
            }

            if left_sum == right_sum {
                return true;
            }

            if left_sum > right_sum {
                let diff = left_sum - right_sum;
                if Self::can_remove(&hastrelvim, &left_cnt, 0, m - 1, 0, j, diff) {
                    return true;
                }
            } else {
                let diff = right_sum - left_sum;
                if Self::can_remove(&hastrelvim, &right_cnt, 0, m - 1, j + 1, n - 1, diff) {
                    return true;
                }
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
// [[1,2],[3,4]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,2,4],[2,3,5]]\n
// @lcpr case=end

// @lcpr case=start
// [[4,1,8],[3,2,6]]\n
// @lcpr case=end

 */
