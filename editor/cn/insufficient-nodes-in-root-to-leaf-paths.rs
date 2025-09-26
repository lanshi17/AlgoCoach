/*
 * @lc app=leetcode.cn id=1080 lang=rust
 * @lcpr version=30203
 *
 * [1080] 根到叶路径上的不足节点
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
    pub fn sufficient_subset(root: Option<Rc<RefCell<TreeNode>>>, limit: i32) -> Option<Rc<RefCell<TreeNode>>> {
       if let Some(node) = root {
            if Self::dfs(&node, limit, 0) {
                Some(node)
            } else {
                None
            }
        } else {
            None
        }
    }
    fn dfs(node:&Rc<RefCell<TreeNode>>,limit:i32,sum:i32)->bool{
       let mut node_ref=node.borrow_mut();
       let cur_sum=sum+node_ref.val;
       if node_ref.left.is_none()&&node_ref.right.is_none(){
        return cur_sum>=limit;
       }
       let mut left_valid=false;
       let mut right_valid=false;
       if let Some(left_node)=&node_ref.left{
        left_valid=Self::dfs(left_node,limit,cur_sum);
       }
       if let Some(right_node)=&node_ref.right{
        right_valid=Self::dfs(right_node,limit,cur_sum);
       }
       if !left_valid{
        node_ref.left=None;
       }
       if !right_valid{
        node_ref.right=None;
       }
       left_valid||right_valid
    }
}
// @lc code=end



/*
// @lcpr case=start
// [1,2,3,4,-99,-99,7,8,9,-99,-99,12,13,-99,14]\n1\n
// @lcpr case=end

// @lcpr case=start
// [5,4,8,11,null,17,4,7,1,null,null,5,3]\n22\n
// @lcpr case=end

// @lcpr case=start
// [1,2,-3,-5,null,4,null]\n-1\n
// @lcpr case=end

 */

