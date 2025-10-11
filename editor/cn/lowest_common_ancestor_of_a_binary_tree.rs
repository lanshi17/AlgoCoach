/*
 * @lc app=leetcode.cn id=236 lang=rust
 * @lcpr version=30203
 *
 * [236] 二叉树的最近公共祖先
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
use std::collections::HashSet;
use std::rc::Rc;

impl Solution {
    pub fn lowest_common_ancestor(
        root: Option<Rc<RefCell<TreeNode>>>,
        p: Option<Rc<RefCell<TreeNode>>>,
        q: Option<Rc<RefCell<TreeNode>>>,
    ) -> Option<Rc<RefCell<TreeNode>>> {
        let p_val = p.as_ref()?.borrow().val;
        let q_val = q.as_ref()?.borrow().val;
        Self::find_lca(&root, p_val, q_val)
    }
    fn find_lca(
        root: &Option<Rc<RefCell<TreeNode>>>,
        val1: i32,
        val2: i32,
    ) -> Option<Rc<RefCell<TreeNode>>> {
        match root {
            None => None,
            Some(node) => {
                let node_val = node.borrow().val;
                if node_val == val1 || node_val == val2 {
                    return Some(node.clone());
                }
                let left_res = Self::find_lca(&node.borrow().left, val1, val2);
                let right_res = Self::find_lca(&node.borrow().right, val1, val2);
                match (&left_res, &right_res) {
                    (Some(_), Some(_)) => Some(node.clone()),
                    (Some(_), None) => left_res,
                    (None, Some(_)) => right_res,
                    (None, None) => None,
                }
            },
        }
    }
}
// @lc code=end

/*
// @lcpr case=start
// [3,5,1,6,2,0,8,null,null,7,4]\n5\n1\n
// @lcpr case=end

// @lcpr case=start
// [3,5,1,6,2,0,8,null,null,7,4]\n5\n4\n
// @lcpr case=end

// @lcpr case=start
// [1,2]\n1\n2\n
// @lcpr case=end

 */
