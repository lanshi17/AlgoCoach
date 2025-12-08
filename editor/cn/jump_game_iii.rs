/*
 * @lc app=leetcode.cn id=1306 lang=rust
 * @lcpr version=30304
 *
 * [1306] 跳跃游戏 III
 */

// @lc code=start
use std::collections::VecDeque;
impl Solution {
    /// 判断是否可以从起始位置跳跃到值为 0 的任意位置
    ///
    /// # Arguments
    /// * `arr`: Vec<i32> - 非负整数数组，每个元素代表从该索引可以跳跃的最大距离。
    /// * `start`: i32 - 起始索引。
    ///
    /// # Returns
    /// * `bool` - 如果可以跳跃到值为 0 的元素，返回 true；否则返回 false。
    pub fn can_reach(arr: Vec<i32>, start: i32) -> bool {
        let n = arr.len() as i32; // 将长度转换为 i32 便于与索引计算
                                  // 使用 Vec<bool> 记录每个索引是否已被访问，防止重复访问和无限循环
        let mut visited: Vec<bool> = vec![false; n as usize];
        // 使用 VecDeque 作为队列来实现 BFS
        let mut queue: VecDeque<i32> = VecDeque::new();

        // 从给定的 start 位置开始搜索
        queue.push_back(start);
        visited[start as usize] = true;

        // BFS 主循环
        while let Some(current_index) = queue.pop_front() {
            // 如果当前位置的值为 0，则找到了目标
            if arr[current_index as usize] == 0 {
                return true;
            }

            // 计算向左跳跃后的新索引
            let left_index = current_index - arr[current_index as usize];
            // 检查新索引是否有效且未被访问
            if left_index >= 0 && !visited[left_index as usize] {
                visited[left_index as usize] = true;
                queue.push_back(left_index);
            }

            // 计算向右跳跃后的新索引
            let right_index = current_index + arr[current_index as usize];
            // 检查新索引是否有效且未被访问
            // 注意：right_index < n 是关键的边界检查
            if right_index < n && !visited[right_index as usize] {
                visited[right_index as usize] = true;
                queue.push_back(right_index);
            }
        }

        // BFS 结束仍未找到值为 0 的元素
        false
    }
}
// @lc code=end

/*
// @lcpr case=start
// [4,2,3,0,3,1,2]\n5\n
// @lcpr case=end

// @lcpr case=start
// [4,2,3,0,3,1,2]\n0\n
// @lcpr case=end

// @lcpr case=start
// [3,0,2,1,2]\n2\n
// @lcpr case=end

 */
