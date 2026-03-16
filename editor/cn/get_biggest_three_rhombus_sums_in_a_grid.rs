/*
 * @lc app=leetcode.cn id=1878 lang=rust
 * @lcpr version=30400
 *
 * [1878] 矩阵中最大的三个菱形和
 */

// @lc code=start
use std::collections::BTreeSet;
impl Solution {
    pub fn get_biggest_three(grid: Vec<Vec<i32>>) -> Vec<i32> {
        let m = grid.len();
        let n = grid[0].len();

        // 主对角线 (\) 前缀
        let mut d1 = vec![vec![0i64; n + 1]; m + 1];
        // 副对角线 (/) 前缀
        let mut d2 = vec![vec![0i64; n + 2]; m + 1];

        for i in 1..=m {
            for j in 1..=n {
                let v = grid[i - 1][j - 1] as i64;
                d1[i][j] = v + d1[i - 1][j - 1];
                d2[i][j] = v + d2[i - 1][j + 1];
            }
        }

        // \ 对角线区间和
        let sum_d1 = |x1: usize, y1: usize, x2: usize, y2: usize, d1: &Vec<Vec<i64>>| -> i64 {
            d1[x2][y2] - d1[x1 - 1][y1 - 1]
        };
        // / 对角线区间和
        let sum_d2 = |x1: usize, y1: usize, x2: usize, y2: usize, d2: &Vec<Vec<i64>>| -> i64 {
            d2[x2][y2] - d2[x1 - 1][y1 + 1]
        };

        let mut set = BTreeSet::<i64>::new();

        for i in 0..m {
            for j in 0..n {
                // 半径 0 的菱形
                set.insert(grid[i][j] as i64);

                let max_r = i.min(j).min(m - 1 - i).min(n - 1 - j);
                for r in 1..=max_r {
                    let i0 = i + 1;
                    let j0 = j + 1;
                    let r = r as usize;

                    let top = (i0 - r, j0);
                    let right = (i0, j0 + r);
                    let bottom = (i0 + r, j0);
                    let left = (i0, j0 - r);

                    let s1 = sum_d1(top.0, top.1, right.0, right.1, &d1);
                    let s2 = sum_d2(right.0, right.1, bottom.0, bottom.1, &d2);
                    let s3 = sum_d1(left.0, left.1, bottom.0, bottom.1, &d1);
                    let s4 = sum_d2(top.0, top.1, left.0, left.1, &d2);

                    let corners = grid[i - r][j] as i64
                        + grid[i][j + r] as i64
                        + grid[i + r][j] as i64
                        + grid[i][j - r] as i64;

                    let sum = s1 + s2 + s3 + s4 - corners;
                    set.insert(sum);
                }
            }
        }

        set.iter().rev().take(3).map(|&x| x as i32).collect()
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[3,4,5,1,3],[3,3,4,2,3],[20,30,200,40,10],[1,5,5,4,1],[4,3,2,2,5]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,2,3],[4,5,6],[7,8,9]]\n
// @lcpr case=end

// @lcpr case=start
// [[7,7,7]]\n
// @lcpr case=end

 */
