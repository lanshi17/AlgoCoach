/*
 * @lc app=leetcode.cn id=173 lang=rust
 * @lcpr version=30203
 *
 * [173] 二叉搜索树迭代器
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
struct BSTIterator {
    stack:Vec<Rc<RefCell<TreeNode>>>,
}


/** 
 * `&self` means the method takes an immutable reference.
 * If you need a mutable reference, change it to `&mut self` instead.
 */
impl BSTIterator {

    fn new(root: Option<Rc<RefCell<TreeNode>>>) -> Self {
        let mut iterator=BSTIterator{
            stack:Vec::new(),
        };
        iterator.push_all_left_nodes(root);
        iterator
    }
    fn push_all_left_nodes(&mut self, mut node: Option<Rc<RefCell<TreeNode>>>) {
        while let Some(n)=node {
            self.stack.push(n.clone());
            node=n.borrow().left.clone();
        }
    }
    fn next(&mut self) -> i32 {
        let top=self.stack.pop().unwrap();
        let (res,right)={
            let node=top.borrow();
            (node.val,node.right.clone())
        };
        self.push_all_left_nodes(right);
        res
    }
    
    fn has_next(&self) -> bool {
        !self.stack.is_empty()
    }
}

/**
 * Your BSTIterator object will be instantiated and called as such:
 * let obj = BSTIterator::new(root);
 * let ret_1: i32 = obj.next();
 * let ret_2: bool = obj.has_next();
 */
// @lc code=end



