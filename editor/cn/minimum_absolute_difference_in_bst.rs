/*
 * @lc app=leetcode.cn id=530 lang=rust
 * @lcpr version=30203
 *
 * [530] 二叉搜索树的最小绝对差
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
    pub fn get_minimum_difference(root: Option<Rc<RefCell<TreeNode>>>) -> i32 {
       let mut min_diff=i32::MAX;
       let mut prev:Option<i32>=None;
       Self::inorder(&root,&mut min_diff,&mut prev);
       min_diff
    }
    fn inorder(node:&Option<Rc<RefCell<TreeNode>>>,
        min_diff:&mut i32,
        prev:&mut Option<i32>,   
    ){
        if let Some(n)=node{
            let n_ref=n.borrow();
            Self::inorder(&n_ref.left.clone(),min_diff,prev);
            if let Some(pre_val)=prev{
                *min_diff=(*min_diff).min(n_ref.val-*pre_val);
            }
            *prev=Some(n_ref.val);
            Self::inorder(&n_ref.right.clone(),min_diff,prev);
        }
    }
}
// @lc code=end



/*
// @lcpr case=start
// [4,2,6,1,3]\n
// @lcpr case=end

// @lcpr case=start
// [1,0,48,null,null,12,49]\n
// @lcpr case=end

 */

