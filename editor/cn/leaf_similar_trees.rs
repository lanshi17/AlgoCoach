/*
 * @lc app=leetcode.cn id=872 lang=rust
 * @lcpr version=30203
 *
 * [872] 叶子相似的树
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
    pub fn leaf_similar(
        root1: Option<Rc<RefCell<TreeNode>>>,
        root2: Option<Rc<RefCell<TreeNode>>>,
    ) -> bool {
        fn get_leaf_values(root: Option<Rc<RefCell<TreeNode>>>) -> Vec<i32> {
            let mut res = Vec::new();
            if let Some(node) = root {
                let node_ref = node.borrow();
                if node_ref.left.is_none() && node_ref.right.is_none() {
                    res.push(node_ref.val);
                } else {
                    res.extend(get_leaf_values(node_ref.left.clone()));
                    res.extend(get_leaf_values(node_ref.right.clone()));
                }
            }
            res
        }
        get_leaf_values(root1) == get_leaf_values(root2)
    }
}
// @lc code=end

/*
// @lcpr case=start
// [3,5,1,6,2,9,8,null,null,7,4]\n[3,5,1,6,7,4,2,null,null,null,null,null,null,9,8]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3]\n[1,3,2]\n
// @lcpr case=end

 */
