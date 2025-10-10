/*
 * @lc app=leetcode.cn id=1305 lang=rust
 * @lcpr version=30203
 *
 * [1305] 两棵二叉搜索树中的所有元素
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
    pub fn get_all_elements(root1: Option<Rc<RefCell<TreeNode>>>, root2: Option<Rc<RefCell<TreeNode>>>) -> Vec<i32> {
        let mut iterator1=BSTIterator::new(root1);
        let mut iterator2=BSTIterator::new(root2);
        let mut res=Vec::new();
        let mut val1=if iterator1.has_next(){
            Some(iterator1.next())
        }else{None};
        let mut val2=if iterator2.has_next(){
            Some(iterator2.next())
        }else{None};
        while val1.is_some()||val2.is_some(){
            match (val1,val2){
                (Some(v1),Some(v2))=>{
                    if v1<=v2{
                        res.push(v1);
                        val1=if iterator1.has_next(){Some(iterator1.next())}else{None};
                    }else{
                        res.push(v2);
                        val2=if iterator2.has_next(){Some(iterator2.next())}else{None};
                    }
                },
                (None,Some(v2))=>{
                    res.push(v2);
                    val2=if iterator2.has_next(){Some(iterator2.next())}else{None};
                },
                (Some(v1),None)=>{
                    res.push(v1);
                    val1=if iterator1.has_next(){Some(iterator1.next())}else{None};
                },
                (None,None)=>break,
            }
        }
        res
    }
}
struct BSTIterator {
    stack: Vec<Rc<RefCell<TreeNode>>>,
}

impl BSTIterator {
    fn new(root: Option<Rc<RefCell<TreeNode>>>) -> Self {
        let mut iterator = BSTIterator {
            stack: Vec::new(),
        };
        iterator.push_all_left_nodes(root);
        iterator
    }
    
    fn push_all_left_nodes(&mut self, mut node: Option<Rc<RefCell<TreeNode>>>) {
        while let Some(current) = node {
            self.stack.push(current.clone());
            node = current.borrow().left.clone();
        }
    }
    
    fn next(&mut self) -> i32 {
        let top = self.stack.pop().unwrap();
        let result = top.borrow().val;
        self.push_all_left_nodes(top.borrow().right.clone());
        result
    }
    
    fn has_next(&self) -> bool {
        !self.stack.is_empty()
    }
}
// @lc code=end



/*
// @lcpr case=start
// [2,1,4]\n[1,0,3]\n
// @lcpr case=end

// @lcpr case=start
// [1,null,8]\n[8,1]\n
// @lcpr case=end

 */

