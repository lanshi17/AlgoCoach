/*
 * @lc app=leetcode.cn id=1302 lang=rust
 * @lcpr version=30203
 *
 * [1302] 层数最深叶子节点的和
 */

// @lc code=start
// Definition for a binary tree node.
// #[derive(Debug, PartialEq, Eq)]
// pub struct TreeNode {
//   pub val: i32,
//   pub left: Option<Rc<RefCell<TreeNode>>>,
//   pub right: Option<Rc<RefCell<TreeNode>>>,
// }
//
// impl TreeNode {
//   #[inline]
//   pub fn new(val: i32) -> Self {
//     TreeNode {
//       val,
//       left: None,
//       right: None
//     }
//   }
// }
use std::cell::RefCell;
use std::collections::VecDeque;
use std::rc::Rc;
impl Solution {
    pub fn deepest_leaves_sum(root: Option<Rc<RefCell<TreeNode>>>) -> i32 {
        let root_node = match root {
            Some(node) => node,
            None => return 0,
        };
        let mut q = VecDeque::new();
        q.push_back(root_node);
        let mut level_sum = 0;
        while !q.is_empty() {
            let level_size = q.len();
            level_sum = 0;
            for _ in 0..level_size {
                if let Some(node) = q.pop_front() {
                    let node_ref = node.borrow();
                    level_sum += node_ref.val;
                    if let Some(left) = node_ref.left.clone() {
                        q.push_back(left);
                    }
                    if let Some(right) = node_ref.right.clone() {
                        q.push_back(right);
                    }
                }
            }
        }
        level_sum
    }
}
// @lc code=end

/*
// @lcpr case=start
// [1,2,3,4,5,null,6,7,null,null,null,null,8]\n
// @lcpr case=end

// @lcpr case=start
// [6,7,8,2,7,1,3,9,null,1,4,null,null,null,5]\n
// @lcpr case=end

 */
