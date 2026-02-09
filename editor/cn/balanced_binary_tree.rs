/*
 * @lc app=leetcode.cn id=110 lang=rust
 * @lcpr version=30307
 *
 * [110] 平衡二叉树
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
    pub fn is_balanced(root: Option<Rc<RefCell<TreeNode>>>) -> bool {
        Self::check_height(&root).is_some()
    }
    fn check_height(root: &Option<Rc<RefCell<TreeNode>>>) -> Option<i32> {
        match root {
            None => Some(0),
            Some(node) => {
                let ref_node = node.borrow();
                let left = Self::check_height(&ref_node.left)?;
                let right = Self::check_height(&ref_node.right)?;
                if (right - left).abs() <= 1 {
                    Some(1 + left.max(right))
                } else {
                    None
                }
            }
        }
    }
}
// @lc code=end

/*
// @lcpr case=start
// [3,9,20,null,null,15,7]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,2,3,3,null,null,4,4]\n
// @lcpr case=end

// @lcpr case=start
// []\n
// @lcpr case=end

 */
