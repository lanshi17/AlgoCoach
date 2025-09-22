/*
 * @lc app=leetcode.cn id=606 lang=rust
 * @lcpr version=30203
 *
 * [606] 根据二叉树创建字符串
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
    pub fn tree2str(root: Option<Rc<RefCell<TreeNode>>>) -> String {
       match root{
        None=> String::from(""),
        Some(node)=>{
            let n_ref=node.borrow();
            if n_ref.left.is_none()&&n_ref.right.is_none(){
                return n_ref.val.to_string();
            }
            let left_str=Self::tree2str(n_ref.left.clone());
            let right_str=Self::tree2str(n_ref.right.clone());
            match (n_ref.left.is_some(), n_ref.right.is_some()) {
                    (true, false) => {
                        format!("{}({})", n_ref.val, left_str)
                    },
                    (false, true) => {
                        format!("{}()({})", n_ref.val, right_str)
                    },
                    (true, true) => {
                        format!("{}({})({})", n_ref.val, left_str, right_str)
                    },
                    (false, false) => n_ref.val.to_string(),
                }
        }
       } 
    }
}
// @lc code=end



/*
// @lcpr case=start
// [1,2,3,4]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3,null,4]\n
// @lcpr case=end

 */

