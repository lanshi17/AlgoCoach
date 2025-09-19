/*
 * @lc app=leetcode.cn id=1372 lang=rust
 * @lcpr version=30203
 *
 * [1372] 二叉树中的最长交错路径
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
    pub fn longest_zig_zag(root: Option<Rc<RefCell<TreeNode>>>) -> i32 {
       fn dfs(node:&Option<Rc<RefCell<TreeNode>>>,res:&mut i32)->(i32,i32){
         match node{
            None=>(-1,-1),
            Some(n)=>{
                let n_ref=n.borrow();
                let (left_left, left_right) = dfs(&n_ref.left, res);
                let (right_left, right_right) = dfs(&n_ref.right, res);
                let node_path_len1=left_right+1;
                let node_path_len2=right_left+1;
                *res=(*res).max(node_path_len1.max(node_path_len2));
                (node_path_len1,node_path_len2)
            }
         }
       } 
       let mut res:i32=0;
       dfs(&root,&mut res);
       res
    }
}
// @lc code=end



/*
// @lcpr case=start
// [1,null,1,1,1,null,null,1,1,null,1,null,null,null,1,null,1]\n
// @lcpr case=end

// @lcpr case=start
// [1,1,1,null,1,null,null,1,1,null,1]\n
// @lcpr case=end

// @lcpr case=start
// [1]\n
// @lcpr case=end

 */

