/*
 * @lc app=leetcode.cn id=103 lang=rust
 * @lcpr version=30203
 *
 * [103] 二叉树的锯齿形层序遍历
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
    pub fn zigzag_level_order(root: Option<Rc<RefCell<TreeNode>>>) -> Vec<Vec<i32>> {
        let mut res = Vec::new();
        let mut deque = VecDeque::new();
        if let Some(node) = root {
            deque.push_back(node);
        }
        let mut flag = true;
        while !deque.is_empty() {
            let size = deque.len();
            let mut cur_vec = Vec::with_capacity(size);
            for _ in 0..size {
                if let Some(node) = deque.pop_front() {
                    let node_ref = node.borrow();
                    cur_vec.push(node_ref.val);

                    if let Some(left) = node_ref.left.as_ref() {
                        deque.push_back(left.clone());
                    }
                    if let Some(right) = node_ref.right.as_ref() {
                        deque.push_back(right.clone())
                    }
                }
            }
            if !flag{
                cur_vec.reverse();
            }
            flag = !flag;
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
