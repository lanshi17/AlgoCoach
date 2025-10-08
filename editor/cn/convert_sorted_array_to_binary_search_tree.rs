/*
 * @lc app=leetcode.cn id=108 lang=rust
 * @lcpr version=30203
 *
 * [108] 将有序数组转换为二叉搜索树
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
    pub fn sorted_array_to_bst(nums: Vec<i32>) -> Option<Rc<RefCell<TreeNode>>> {
       if nums.is_empty(){
        return None;
       } 
       Self::build_bst(&nums,0,nums.len())
    }
    fn build_bst(
        nums:&Vec<i32>,
        left:usize,
        right:usize,
    )->Option<Rc<RefCell<TreeNode>>>{
        if left>=right{
            return None;
        }
        let mid=left+(right-left)/2;
        let node=Rc::new(RefCell::new(TreeNode::new(nums[mid])));
        node.borrow_mut().left=Self::build_bst(&nums,left,mid);
        node.borrow_mut().right=Self::build_bst(&nums,mid+1,right);
        Some(node)
    }
}
// @lc code=end



/*
// @lcpr case=start
// [-10,-3,0,5,9]\n
// @lcpr case=end

// @lcpr case=start
// [1,3]\n
// @lcpr case=end

 */

