/*
 * @lc app=leetcode.cn id=1008 lang=rust
 * @lcpr version=30203
 *
 * [1008] 前序遍历构造二叉搜索树
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
    pub fn bst_from_preorder(preorder: Vec<i32>) -> Option<Rc<RefCell<TreeNode>>> {
       if preorder.is_empty(){
        return None;
       } 
       let root=Rc::new(RefCell::new(TreeNode::new(preorder[0])));
       let mut stack=vec![root.clone()];
       for i in 1..preorder.len(){
        let val=preorder[i];
        let node=Rc::new(RefCell::new(TreeNode::new(val)));
        if val<stack.last().unwrap().borrow().val{
            stack.last().unwrap().borrow_mut().left=Some(node.clone());
        }else{
            let mut parent=stack.pop().unwrap();
            while !stack.is_empty()&&val>stack.last().unwrap().borrow().val{
                parent=stack.pop().unwrap();
            }
            parent.borrow_mut().right=Some(node.clone());
        }
        stack.push(node);
       }
       Some(root)
    }
}
// @lc code=end



/*
// @lcpr case=start
// [8,5,1,7,10,12]\n
// @lcpr case=end

// @lcpr case=start
// [1,3]\n
// @lcpr case=end

 */

