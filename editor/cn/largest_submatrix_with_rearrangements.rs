/*
 * @lc app=leetcode.cn id=1727 lang=rust
 * @lcpr version=30400
 *
 * [1727] 重新排列后的最大子矩阵
 */

// @lc code=start
impl Solution {
    pub fn largest_submatrix(matrix: Vec<Vec<i32>>) -> i32 {
        let m = matrix.len();
        let n = matrix[0].len();

        let mut height = vec![0usize; n];
        let mut tmp = vec![0usize; n]; // 复用，避免重复分配
        let mut ans = 0usize;

        for i in 0..m {
            // 1) 更新高度
            for j in 0..n {
                height[j] = if matrix[i][j] == 1 { height[j] + 1 } else { 0 };
            }

            // 2) 排序高度（降序）
            tmp.copy_from_slice(&height);
            tmp.sort_unstable_by(|a, b| b.cmp(a));

            // 3) 计算最大面积
            for (k, &h) in tmp.iter().enumerate() {
                if h == 0 {
                    break;
                } // 后面都是 0，可提前结束
                let area = h * (k + 1);
                if area > ans {
                    ans = area;
                }
            }
        }

        ans as i32
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[0,0,1],[1,1,1],[1,0,1]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,0,1,0,1]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,1,0],[1,0,1]]\n
// @lcpr case=end

 */
