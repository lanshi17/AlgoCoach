/*
 * @lc app=leetcode.cn id=671 lang=rust
 * @lcpr version=30203
 *
 * [671] 二叉树中第二小的节点
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
use std::rc::Rc;
use std::cell::RefCell;
impl Solution {
    pub fn find_second_minimum_value(root: Option<Rc<RefCell<TreeNode>>>) -> i32 {
        let root_val = match &root {
            Some(node) => node.borrow().val,
            None => return -1,
        };
        let mut second_min = None;
        Self::dfs(&root, root_val, &mut second_min);
        second_min.unwrap_or(-1)
    }
    fn dfs(node: &Option<Rc<RefCell<TreeNode>>>, root_val: i32, second_min: &mut Option<i32>) {
        if let Some(n) = node {
            let n_val = n.borrow().val;
            if n_val > root_val {
                match second_min {
                    Some(cur_second) => {
                        if n_val < *cur_second {
                            *second_min = Some(n_val);
                        }
                    }
                    None => {
                        *second_min = Some(n_val);
                    }
                }
            }
            Self::dfs(&n.borrow().left, root_val, second_min);
            Self::dfs(&n.borrow().right, root_val, second_min);
        }
    }
}
// @lc code=end



/*
// @lcpr case=start
// [2,2,5,null,null,5,7]\n
// @lcpr case=end

// @lcpr case=start
// [2,2,2]\n
// @lcpr case=end

 */

