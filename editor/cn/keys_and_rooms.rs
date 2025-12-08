/*
 * @lc app=leetcode.cn id=841 lang=rust
 * @lcpr version=30304
 *
 * [841] 钥匙和房间
 */

// @lc code=start
use std::collections::VecDeque;
impl Solution {
    /// 判断是否能进入所有房间
    ///
    /// # Arguments
    /// * `rooms`: Vec<Vec<i32>> - 一个二维向量，rooms[i] 包含在房间 i 里能找到的钥匙列表。
    ///
    /// # Returns
    /// * `bool` - 如果可以进入所有房间，返回 true；否则返回 false。
    pub fn can_visit_all_rooms(rooms: Vec<Vec<i32>>) -> bool {
        let n = rooms.len();
        let mut visited: Vec<bool> = vec![false; n];
        let mut dequeue: VecDeque<usize> = VecDeque::new();
        dequeue.push_back(0);
        visited[0] = true;
        while let Some(current_room) = dequeue.pop_front() {
            for &key in &rooms[current_room] {
                if !visited[key as usize] {
                    dequeue.push_back(key as usize);
                    visited[key as usize] = true;
                }
            }
        }
        visited.iter().all(|&v| v)
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[1],[2],[3],[]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,3],[3,0,1],[2],[0]]\n
// @lcpr case=end

 */
