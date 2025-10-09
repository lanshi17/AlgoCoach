/*
 * @lc app=leetcode.cn id=109 lang=rust
 * @lcpr version=30203
 *
 * [109] 有序链表转换二叉搜索树
 */

// @lc code=start
// Definition for singly-linked list.
// #[derive(PartialEq, Eq, Clone, Debug)]
// pub struct ListNode {
//   pub val: i32,
//   pub next: Option<Box<ListNode>>
// }
// 
// impl ListNode {
//   #[inline]
//   fn new(val: i32) -> Self {
//     ListNode {
//       next: None,
//       val
//     }
//   }
// }
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
    pub fn sorted_list_to_bst(head: Option<Box<ListNode>>) -> Option<Rc<RefCell<TreeNode>>> {
       let mut values=Vec::new();
       let mut current=head;
       while let Some(node)=current{
        values.push(node.val);
        current=node.next;
       } 
       Self::built_bst(&values,0,values.len())
    }
    fn built_bst(
        values:&Vec<i32>,
        left:usize,
        right:usize,
    )->Option<Rc<RefCell<TreeNode>>>{
        if left>=right{
            return None;
        }
        let mid=left+(right-left)/2;
        let node=Rc::new(RefCell::new(TreeNode::new(values[mid])));
        node.borrow_mut().left=Self::built_bst(&values,left,mid);
        node.borrow_mut().right=Self::built_bst(&values,mid+1,right);
        Some(node)
    }
}
// @lc code=end



/*
// @lcpr case=start
// [-10,-3,0,5,9]\n
// @lcpr case=end

// @lcpr case=start
// []\n
// @lcpr case=end

 */

