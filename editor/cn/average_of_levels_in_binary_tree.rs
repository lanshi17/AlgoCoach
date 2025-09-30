/*
 * @lc app=leetcode.cn id=637 lang=rust
 * @lcpr version=30203
 *
 * [637] 二叉树的层平均值
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
    pub fn average_of_levels(root: Option<Rc<RefCell<TreeNode>>>) -> Vec<f64> {
        if root.is_none() {
            return vec![];
        }
        let mut res = Vec::new();
        let mut q = VecDeque::new();
        q.push_back(root.unwrap());
        while !q.is_empty() {
            let level_size = q.len();
            let mut average = 0.0;
            for _ in 0..level_size {
                if let Some(node) = q.pop_front() {
                    let node_ref = node.borrow();
                    average+=node_ref.val as f64;
                    if let Some(left)=node_ref.left.as_ref(){
                        q.push_back(left.clone());
                    }
                    if let Some(right)=node_ref.right.as_ref(){
                        q.push_back(right.clone());
                    }
                }
            }
            res.push(average/(level_size as f64));
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// [3,9,20,null,null,15,7]\n
// @lcpr case=end

// @lcpr case=start
// [3,9,20,15,7]\n
// @lcpr case=end

 */
