/*
 * @lc app=leetcode.cn id=1382 lang=rust
 * @lcpr version=30203
 *
 * [1382] 将二叉搜索树变平衡
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
impl Solution {
    pub fn balance_bst(root: Option<Rc<RefCell<TreeNode>>>) -> Option<Rc<RefCell<TreeNode>>> {
        let mut values = Vec::new();
        Self::inorder_tarversal(&root, &mut values);
        Self::build_balance_bst(&values, 0, values.len())
    }
    fn inorder_tarversal(root: &Option<Rc<RefCell<TreeNode>>>, values: &mut Vec<i32>) {
        if let Some(node) = root {
            let node = node.borrow();
            Self::inorder_tarversal(&node.left, values);
            values.push(node.val);
            Self::inorder_tarversal(&node.right, values);
        }
    }
    fn build_balance_bst(
        values: &Vec<i32>,
        left: usize,
        right: usize,
    ) -> Option<Rc<RefCell<TreeNode>>> {
        if left >= right {
            return None;
        }
        let mut mid = left + (right - left) / 2;
        let mut node = Rc::new(RefCell::new(TreeNode::new(values[mid])));
        node.borrow_mut().left = Self::build_balance_bst(values, left, mid);
        node.borrow_mut().right = Self::build_balance_bst(values, mid + 1, right);
        Some(node)
    }
}
// @lc code=end

/*
// @lcpr case=start
// [1,null,2,null,3,null,4,null,null]\n
// @lcpr case=end

// @lcpr case=start
// [2,1,3]\n
// @lcpr case=end

 */
