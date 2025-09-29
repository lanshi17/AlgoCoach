/*
 * @lc app=leetcode.cn id=515 lang=rust
 * @lcpr version=30203
 *
 * [515] 在每个树行中找最大值
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
    pub fn largest_values(root: Option<Rc<RefCell<TreeNode>>>) -> Vec<i32> {
        if root.is_none() {
            return vec![];
        }
        let mut res = Vec::new();
        let mut q = VecDeque::new();
        q.push_back(root.unwrap());
        while !q.is_empty() {
            let level_size = q.len();
            let mut max_val = i32::MIN;
            for _ in 0..level_size {
                if let Some(node) = q.pop_front(){
                    let node_ref = node.borrow();
                    max_val = max_val.max(node_ref.val);
                    if let Some(left) = node_ref.left.as_ref() {
                        q.push_back(left.clone());
                    }
                    if let Some(right) = node_ref.right.as_ref() {
                        q.push_back(right.clone());
                    }
                }
            }
            res.push(max_val);
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// [1,3,2,5,3,null,9]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3]\n
// @lcpr case=end

 */
