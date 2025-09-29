/*
 * @lc app=leetcode.cn id=662 lang=rust
 * @lcpr version=30203
 *
 * [662] 二叉树最大宽度
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
use std::collections::VecDeque;
impl Solution {
    pub fn width_of_binary_tree(root: Option<Rc<RefCell<TreeNode>>>) -> i32 {
        if root.is_none(){
            return 0;
        }
        let mut max_width=0;
        let mut q=VecDeque::new();
        q.push_back((root.unwrap(),0));
        while !q.is_empty(){
            let level_size=q.len();
            let first_index=q.front().map(|&(_,index)|index).unwrap_or(0);
            let last_index=q.back().map(|&(_,index)|index).unwrap_or(0);
            max_width=max_width.max(last_index-first_index+1);
            for _ in 0..level_size{
                if let Some((node,index))=q.pop_front(){
                    let node_ref=node.borrow();
                    if let Some(left)=node_ref.left.as_ref(){
                        q.push_back((left.clone(),index*2));
                    }
                    if let Some(right)=node_ref.right.as_ref(){
                        q.push_back((right.clone(),index*2+1));
                    }
                }
            }
        }
        max_width

    }
}
// @lc code=end



/*
// @lcpr case=start
// [1,3,2,5,3,null,9]\n
// @lcpr case=end

// @lcpr case=start
// [1,3,2,5,null,null,9,6,null,7]\n
// @lcpr case=end

// @lcpr case=start
// [1,3,2,5]\n
// @lcpr case=end

 */

