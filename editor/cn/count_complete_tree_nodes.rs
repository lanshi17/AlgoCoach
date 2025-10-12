/*
 * @lc app=leetcode.cn id=222 lang=rust
 * @lcpr version=30203
 *
 * [222] 完全二叉树的节点个数
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
    pub fn count_nodes(root: Option<Rc<RefCell<TreeNode>>>) -> i32 {
        Self::dfs(&root)
    }

    fn dfs(root: &Option<Rc<RefCell<TreeNode>>>) -> i32 {
        match root {
            None => 0,
            Some(node_rc) => {
                let left_height = Self::height(root.clone(), true);
                let right_height = Self::height(root.clone(), false);
                if left_height == right_height {
                    ((1u64 << left_height) - 1) as i32
                } else {
                    let (left, right) = {
                        let node_ref = node_rc.borrow();
                        (node_ref.left.clone(), node_ref.right.clone())
                    };
                    1 + Self::dfs(&left) + Self::dfs(&right)
                }
            }
        }
    }

    fn height(mut node: Option<Rc<RefCell<TreeNode>>>, go_left: bool) -> u32 {
        let mut height = 0;
        while let Some(rc) = node {
            height += 1;
            node = {
                let node_ref = rc.borrow();
                if go_left {
                    node_ref.left.clone()
                } else {
                    node_ref.right.clone()
                }
            };
        }
        height
    }
}
// @lc code=end



/*
// @lcpr case=start
// [1,2,3,4,5,6]\n
// @lcpr case=end

// @lcpr case=start
// []\n
// @lcpr case=end

// @lcpr case=start
// [1]\n
// @lcpr case=end

 */

