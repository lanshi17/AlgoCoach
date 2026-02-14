/*
 * @lc app=leetcode.cn id=799 lang=rust
 * @lcpr version=30307
 *
 * [799] 香槟塔
 */

// @lc code=start
impl Solution {
    pub fn champagne_tower(poured: i32, query_row: i32, query_glass: i32) -> f64 {
        let r = query_row as usize;
        let c = query_glass as usize;

        let mut tower = vec![vec![0.0; r + 1]; r + 1];

        // 将所有香槟先倒入顶层
        tower[0][0] = poured as f64;
        for i in 0..r {
            for j in 0..=i {
                if tower[i][j] >= 1.0 {
                    let overflow = (tower[i][j] - 1.0) / 2.0;
                    tower[i][j] = 1.0;
                    tower[i + 1][j] += overflow;
                    tower[i + 1][j + 1] += overflow;
                }
            }
        }
        if tower[r][c] > 1.0 {
            1.0
        } else {
            tower[r][c]
        }
    }
}
// @lc code=end

/*
// @lcpr case=start
// 1\n1\n1\n
// @lcpr case=end

// @lcpr case=start
// 2\n1\n1\n
// @lcpr case=end

// @lcpr case=start
// 100000009\n33\n17\n
// @lcpr case=end

 */
