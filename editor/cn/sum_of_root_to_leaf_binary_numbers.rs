/*
 * @lc app=leetcode.cn id=1022 lang=rust
 * @lcpr version=30400
 *
 * [1022] 从根到叶的二进制数之和
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
use std::rc::Rc;
impl Solution {
    pub fn sum_root_to_leaf(root: Option<Rc<RefCell<TreeNode>>>) -> i32 {
        fn dfs(root: &Option<Rc<RefCell<TreeNode>>>, cur_val: i32) -> i32 {
            if let Some(node) = root {
                let node_ref = node.borrow();
                let node_val = node_ref.val;
                let new_cur_val = (cur_val << 1) | node_val;
                if node_ref.left.is_none() && node_ref.right.is_none() {
                    new_cur_val
                } else {
                    dfs(&node_ref.left, new_cur_val) + dfs(&node_ref.right, new_cur_val)
                }
            } else {
                0
            }
        }
        dfs(&root, 0)
    }
}
// @lc code=end

/*
// @lcpr case=start
// [1,0,1,0,1,0,1]\n
// @lcpr case=end

// @lcpr case=start
// [0]\n
// @lcpr case=end

 */
