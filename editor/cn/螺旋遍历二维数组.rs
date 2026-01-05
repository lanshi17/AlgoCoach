/*
 * @lc app=leetcode.cn id=LCR 146 lang=rust
 * @lcpr version=30305
 *
 * [LCR 146] 螺旋遍历二维数组
 */

// @lc code=start
impl Solution {
    /// 螺旋遍历矩阵
    ///
    /// # Arguments
    /// * `array` - 一个二维整数向量，表示待遍历的矩阵
    ///
    /// # Returns
    /// 一个一维整数向量，包含按螺旋顺序遍历的所有元素
    pub fn spiral_array(array: Vec<Vec<i32>>) -> Vec<i32> {
        // 处理空矩阵的边界情况
        if array.is_empty() || array[0].is_empty() {
            return vec![];
        }

        let rows = array.len();
        let cols = array[0].len();

        // 初始化边界
        let mut top = 0;
        let mut bottom = rows - 1; // 使用 usize，注意减法溢出
        let mut left = 0;
        let mut right = cols - 1; // 使用 usize，注意减法溢出

        let mut result = Vec::with_capacity(rows * cols); // 预分配空间以提高性能

        while top <= bottom && left <= right {
            // 1. 向右遍历 (top 行)
            for col in left..=right {
                result.push(array[top][col]);
            }
            // 遍历完 top 行后，上边界下移
            if top < usize::MAX {
                // 防止 usize 溢出
                top += 1;
            } else {
                break; // 如果 top 已经是最大值，说明矩阵已遍历完
            }

            // 2. 向下遍历 (right 列)
            for row in top..=bottom {
                result.push(array[row][right]);
            }
            // 遍历完 right 列后，右边界左移
            if right > 0 {
                // 防止 usize 溢出
                right -= 1;
            } else {
                break; // 如果 right 已经是 0，减 1 会溢出，此时矩阵已遍历完
            }

            // 3. 向左遍历 (bottom 行)，需要检查 top 是否仍然 <= bottom
            if top <= bottom {
                for col in (left..=right).rev() {
                    result.push(array[bottom][col]);
                }
                // 遍历完 bottom 行后，下边界上移
                if bottom > 0 {
                    // 防止 usize 溢出
                    bottom -= 1;
                } else {
                    break; // 如果 bottom 已经是 0，减 1 会溢出，此时矩阵已遍历完
                }
            }

            // 4. 向上遍历 (left 列)，需要检查 left 是否仍然 <= right
            if left <= right {
                for row in (top..=bottom).rev() {
                    result.push(array[row][left]);
                }
                // 遍历完 left 列后，左边界右移
                if left < usize::MAX {
                    // 防止 usize 溢出
                    left += 1;
                } else {
                    break; // 如果 left 已经是最大值，说明矩阵已遍历完
                }
            }
        }

        result
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[1,2,3],[4,5,6],[7,8,9]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,2,3,4],[12,13,14,5],[11,16,15,6],[10,9,8,7]]\n
// @lcpr case=end

 */
