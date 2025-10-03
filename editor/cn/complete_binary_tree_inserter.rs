/*
 * @lc app=leetcode.cn id=919 lang=rust
 * @lcpr version=30203
 *
 * [919] 完全二叉树插入器
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
struct CBTInserter {
    root:Option<Rc<RefCell<TreeNode>>>,
    candidate_parents: VecDeque<Rc<RefCell<TreeNode>>>,
}


/** 
 * `&self` means the method takes an immutable reference.
 * If you need a mutable reference, change it to `&mut self` instead.
 */
impl CBTInserter {

    fn new(root: Option<Rc<RefCell<TreeNode>>>) -> Self {
        use std::collections::VecDeque;
        let mut candidate_parents=VecDeque::new();
        let mut q=VecDeque::new();
        if let Some(root_node)=root.as_ref(){
            q.push_back(root_node.clone());
        }
        while !q.is_empty(){
            let node = q.pop_front().unwrap(); 
            let node_borrowed = node.borrow();
            
            if node_borrowed.left.is_none() || node_borrowed.right.is_none() {
                candidate_parents.push_back(node.clone());
            }

            if let Some(left) = node_borrowed.left.as_ref() {
                q.push_back(left.clone());
            }
            if let Some(right) = node_borrowed.right.as_ref() {
                q.push_back(right.clone());
            }
        }
        CBTInserter{
            root,
            candidate_parents,
        }
    }
    
    fn insert(&mut self, val: i32) -> i32 {
        let new_node_rc = Rc::new(RefCell::new(TreeNode::new(val)));
        
        // 获取下一个候选父节点
        let parent_rc = self.candidate_parents.front().unwrap().clone(); // 题目保证有候选节点
        let mut parent_borrowed = parent_rc.borrow_mut();
        let parent_val = parent_borrowed.val;

        // 决定插入到左子节点还是右子节点
        if parent_borrowed.left.is_none() {
            parent_borrowed.left = Some(new_node_rc.clone());
        } else {
            // 题目逻辑保证 else 分支存在
            parent_borrowed.right = Some(new_node_rc.clone());
        }
        // 释放 parent_borrowed 的可变借用，以便后续操作
        drop(parent_borrowed);

        // 将新节点加入候选队列，因为它现在是叶子节点
        self.candidate_parents.push_back(new_node_rc.clone());

        // 检查父节点是否已完全填充
        if parent_rc.borrow().left.is_some() && parent_rc.borrow().right.is_some() {
            // 如果已满，则从候选队列中移除
            self.candidate_parents.pop_front();
        }

        parent_val
    }
    
    fn get_root(&self) -> Option<Rc<RefCell<TreeNode>>> {
        self.root.clone()
    }
}

/**
 * Your CBTInserter object will be instantiated and called as such:
 * let obj = CBTInserter::new(root);
 * let ret_1: i32 = obj.insert(val);
 * let ret_2: Option<Rc<RefCell<TreeNode>>> = obj.get_root();
 */
// @lc code=end



