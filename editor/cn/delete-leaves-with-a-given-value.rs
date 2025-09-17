/*
 * @lc app=leetcode.cn id=1325 lang=rust
 * @lcpr version=30203
 *
 * [1325] 删除给定值的叶子节点
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
    pub fn remove_leaf_nodes(root: Option<Rc<RefCell<TreeNode>>>, target: i32) -> Option<Rc<RefCell<TreeNode>>> {
       if let Some(node)=root{
        {
            let mut node_ref=node.borrow_mut();
            let left_child=node_ref.left.take();
            node_ref.left=Self::remove_leaf_nodes(left_child,target);
            let right_child=node_ref.right.take();
            node_ref.right=Self::remove_leaf_nodes(right_child,target);
    }
        let should_delete = {
                let node_ref = node.borrow();
                node_ref.val == target 
                    && node_ref.left.is_none() 
                    && node_ref.right.is_none()
            };
        if should_delete{
            None
        }else{
            Some(node)
        }

       }else{
        None
       } 
    }
}
// @lc code=end



/*
// @lcpr case=start
// [1,2,3,2,null,2,4]\n2\n
// @lcpr case=end

// @lcpr case=start
// [1,3,3,3,2]\n3\n
// @lcpr case=end

// @lcpr case=start
// [1,2,null,2,null,2]\n2\n
// @lcpr case=end

 */

