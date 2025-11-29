/*
 * @lc app=leetcode.cn id=89 lang=rust
 * @lcpr version=30304
 *
 * [89] 格雷编码
 */

// @lc code=start
use std::collections::{HashSet, VecDeque};
#[derive(Default)]
struct BT {
    used: HashSet<i32>,
    path: VecDeque<i32>,
    res: Vec<i32>,
}
impl BT {
    fn new() -> Self {
        Self::default()
    }
    fn backtrace(&mut self, root: i32, n: i32) {
        if !self.res.is_empty() {
            return;
        }
        if self.path.len() == (1 << n) as usize {
            self.res = self.path.iter().cloned().collect();
            return;
        }
        if self.used.contains(&root) {
            return;
        }
        self.used.insert(root);
        self.path.push_back(root);
        for i in 0..n {
            self.backtrace(self.flip_bit(root, i), n);
        }
        self.used.remove(&root);
        self.path.pop_back();
    }
    fn flip_bit(&self, x: i32, i: i32) -> i32 {
        x ^ (1 << i)
    }
}
impl Solution {
    pub fn gray_code(n: i32) -> Vec<i32> {
        let mut bt = BT::new();
        bt.backtrace(0, n);
        bt.res
    }
}
// @lc code=end

/*
// @lcpr case=start
// 2\n
// @lcpr case=end

// @lcpr case=start
// 1\n
// @lcpr case=end

 */
