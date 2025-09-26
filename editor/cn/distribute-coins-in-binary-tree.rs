/*
 * @lc app=leetcode.cn id=979 lang=rust
 * @lcpr version=30203
 *
 * [979] 在二叉树中分配硬币
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
    pub fn distribute_coins(root: Option<Rc<RefCell<TreeNode>>>) -> i32 {
       if let Some(node)=root{
            let mut res=0;
            Self::dfs(&node,&mut res);
            res
       } else{
            0
        }
    }

    fn dfs(node:&Rc<RefCell<TreeNode>>,res:&mut i32)->i32{
        let node_ref = node.borrow();
        let left = node_ref.left.as_ref()
            .map_or(0, |left| Self::dfs(left, res));
        let right = node_ref.right.as_ref()
            .map_or(0, |right| Self::dfs(right, res));
        *res += left.abs() + right.abs();
        left + right + node_ref.val - 1
    }
}
// @lc code=end



/*
// @lcpr case=start
// [3,0,0]\n
// @lcpr case=end

// @lcpr case=start
// [0,3,0]\n
// @lcpr case=end

 */

