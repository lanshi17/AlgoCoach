/*
 * @lc app=leetcode.cn id=687 lang=rust
 * @lcpr version=30203
 *
 * [687] 最长同值路径
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
    pub fn longest_univalue_path(root: Option<Rc<RefCell<TreeNode>>>) -> i32 {
        let mut res = 0;
        Self::maxLen(&root, &mut res);
        res
    }
    fn maxLen(node:&Option<Rc<RefCell<TreeNode>>>,res:&mut i32)->i32{
        if let Some(n)=node{
        
            let node_ref=n.borrow();
            let left_len=Self::maxLen(&node_ref.left,res);
            let right_len=Self::maxLen(&node_ref.right,res);
            
            let n=n.borrow();
            let mut left_path=0;
            let mut right_path=0;
            if let Some(left_node)=&n.left{
                if left_node.borrow().val==n.val{
                    left_path=left_len+1;
                }
            }
            if let Some(right_node)=&n.right{
                if right_node.borrow().val==n.val{
                    right_path=right_len+1;
                }

            }
            *res=(*res).max(left_path+right_path);
            left_path.max(right_path)

        }else{
            0
        }
    }
}
// @lc code=end



/*
// @lcpr case=start
// [5,4,5,1,1,5]\n
// @lcpr case=end

// @lcpr case=start
// [1,4,5,4,4,5]\n
// @lcpr case=end

 */

