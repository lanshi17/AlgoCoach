/*
 * @lc app=leetcode.cn id=107 lang=rust
 * @lcpr version=30203
 *
 * [107] 二叉树的层序遍历 II
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
use std::collections::VecDeque;
impl Solution {
    pub fn level_order_bottom(root: Option<Rc<RefCell<TreeNode>>>) -> Vec<Vec<i32>> {
        let mut res=Self::level_order_by_levels(root);
        res.reverse();
        res

    }
    fn level_order_by_levels(root: Option<Rc<RefCell<TreeNode>>>) -> Vec<Vec<i32>> {
        let mut res = Vec::new();
        let mut dequeue = VecDeque::new();
        if let Some(node) = root {
            dequeue.push_back(node);
        }
        while !dequeue.is_empty() {
            let dequeue_size = dequeue.len();
            let mut cur_vec = Vec::with_capacity(dequeue_size);
            for _ in 0..dequeue_size {
                if let Some(node) = dequeue.pop_front() {
                    let node_ref = node.borrow();
                    cur_vec.push(node_ref.val);
                    if let Some(left)=node_ref.left.as_ref(){
                        dequeue.push_back(left.clone());
                    }
                    if let Some(right)=node_ref.right.as_ref(){
                        dequeue.push_back(right.clone());
                    }
                }
            }
            res.push(cur_vec);
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
// [1]\n
// @lcpr case=end

// @lcpr case=start
// []\n
// @lcpr case=end

 */
