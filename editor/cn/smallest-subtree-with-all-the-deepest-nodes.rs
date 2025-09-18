/*
 * @lc app=leetcode.cn id=865 lang=rust
 * @lcpr version=30203
 *
 * [865] 具有所有最深节点的最小子树
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
    pub fn subtree_with_all_deepest(
        root: Option<Rc<RefCell<TreeNode>>>,
    ) -> Option<Rc<RefCell<TreeNode>>> {
        fn dfs(node: &Option<Rc<RefCell<TreeNode>>>) -> (Option<Rc<RefCell<TreeNode>>>, i32) {
            match node {
                None => (None, 0),
                Some(n) => {
                    let n_ref = n.borrow();
                    let (left_node, left_depth) = dfs(&n_ref.left);
                    let (right_node, right_depth) = dfs(&n_ref.right);
                    drop(n_ref);
                    if left_depth > right_depth {
                        (left_node, left_depth + 1)
                    } else if left_depth < right_depth {
                        (right_node, right_depth+1)
                    } else {
                        (Some(n.clone()), left_depth + 1)
                    }
                },
            }
        }
        dfs(&root).0
    }
}
// @lc code=end

/*
// @lcpr case=start
// [3,5,1,6,2,0,8,null,null,7,4]\n
// @lcpr case=end

// @lcpr case=start
// [1]\n
// @lcpr case=end

// @lcpr case=start
// [0,1,3,null,2]\n
// @lcpr case=end

 */
