/*
 * @lc app=leetcode.cn id=623 lang=rust
 * @lcpr version=30202
 *
 * [623] 在二叉树中增加一行
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
    pub fn add_one_row(root: Option<Rc<RefCell<TreeNode>>>, val: i32, depth: i32) -> Option<Rc<RefCell<TreeNode>>> {
       if depth==1{
        let new_root=Rc::new(RefCell::new(TreeNode::new(val)));
        new_root.borrow_mut().left=root;
        Some(new_root)
       } else{
        Self::dfs(&root,val,depth-1);
        root
       }
    }
    fn dfs(node:&Option<Rc<RefCell<TreeNode>>>,val:i32,depth:i32){
        if let Some(n)=node{
            if depth==1{
                let mut node_ref=n.borrow_mut();
                let new_left=Rc::new(RefCell::new(TreeNode::new(val)));
                new_left.borrow_mut().left=node_ref.left.take();
                node_ref.left=Some(new_left);
                let new_right=Rc::new(RefCell::new(TreeNode::new(val)));
                new_right.borrow_mut().right=node_ref.right.take();
                node_ref.right=Some(new_right);
            }else{
                let node_ref=n.borrow();
                Self::dfs(&node_ref.left,val,depth-1);
                Self::dfs(&node_ref.right,val,depth-1);
            }
        }
    }
}
// @lc code=end



/*
// @lcpr case=start
// [4,2,6,3,1,5]\n1\n2\n
// @lcpr case=end

// @lcpr case=start
// [4,2,null,3,1]\n1\n3\n
// @lcpr case=end

 */

