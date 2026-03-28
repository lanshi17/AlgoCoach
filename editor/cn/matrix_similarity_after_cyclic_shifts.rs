/*
 * @lc app=leetcode.cn id=2946 lang=rust
 * @lcpr version=30401
 *
 * [2946] 循环移位后的矩阵相似检查
 */

// @lc code=start
impl Solution {
    pub fn are_similar(mat: Vec<Vec<i32>>, k: i32) -> bool {
        let n = mat[0].len();
        let s = (k as usize) % n;

        mat.iter().enumerate().all(|(i, row)| {
            row.iter().enumerate().all(|(j, &v)| {
                let idx = if i % 2 == 0 {
                    (j + s) % n
                } else {
                    (j + n - s) % n
                };
                v == row[idx]
            })
        })
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[1,2,3],[4,5,6],[7,8,9]]\n4\n
// @lcpr case=end

// @lcpr case=start
// [[1,2,1,2],[5,5,5,5],[6,3,6,3]]\n2\n
// @lcpr case=end

// @lcpr case=start
// [[2,2],[2,2]]\n3\n
// @lcpr case=end

 */
