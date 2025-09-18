/*
 * @lc app=leetcode.cn id=1026 lang=rust
 * @lcpr version=30203
 *
 * [1026] 节点与其祖先之间的最大差值
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
    pub fn max_ancestor_diff(root: Option<Rc<RefCell<TreeNode>>>) -> i32 {
        fn dfs(node: &Option<Rc<RefCell<TreeNode>>>, min_val: i32, max_val: i32) -> i32 {
            match node {
                None => max_val - min_val,
                Some(n) => {
                    let n_ref = n.borrow();
                    let cur_val = n_ref.val;
                    let new_min = min_val.min(cur_val);
                    let new_max = max_val.max(cur_val);
                    dfs(&n_ref.left, new_min, new_max).max(dfs(&n_ref.right, new_min, new_max))
                },
            }
        }
        if let Some(ref root_node) = root {
            let root_ref = root_node.borrow();
            dfs(&root, root_ref.val, root_ref.val)
        } else {
            0
        }
    }
}
// @lc code=end

/*
// @lcpr case=start
// [8,3,10,1,6,null,14,null,null,4,7,13]\n
// @lcpr case=end

// @lcpr case=start
// [1,null,2,null,0,3]\n
// @lcpr case=end

 */
