/*
 * @lc app=leetcode.cn id=958 lang=rust
 * @lcpr version=30203
 *
 * [958] 二叉树的完全性检验
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
    pub fn is_complete_tree(root: Option<Rc<RefCell<TreeNode>>>) -> bool {
        let mut q = VecDeque::new();
        q.push_back(root);
        let mut is_null = false;
        while let Some(node) = q.pop_front() {
            match node {
                Some(node) => {
                    if is_null {
                        return false;
                    }
                    let node_ref = node.borrow();
                    q.push_back(node_ref.left.clone());
                    q.push_back(node_ref.right.clone());
                },
                None => {
                    is_null = true;
                },
            }
        }
        true
    }
}
// @lc code=end

/*
// @lcpr case=start
// [1,2,3,4,5,6]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3,4,5,null,7]\n
// @lcpr case=end

 */
