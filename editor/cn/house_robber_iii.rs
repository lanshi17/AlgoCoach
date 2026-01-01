/*
 * @lc app=leetcode.cn id=337 lang=rust
 * @lcpr version=30305
 *
 * [337] 打家劫舍 III
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
    /// 计算在二叉树结构的房屋中，小偷能盗取的最高金额。
    ///
    /// 使用动态规划，对每个节点计算偷与不偷两种情况下的最大收益。
    ///
    /// # Arguments
    /// * `root` - 二叉树的根节点。
    ///
    /// # Returns
    /// 返回小偷能够盗取的最高金额。
    pub fn rob(root: Option<Rc<RefCell<TreeNode>>>) -> i32 {
        fn rob_helper(node: Option<Rc<RefCell<TreeNode>>>) -> (i32, i32) {
            if let Some(n) = node {
                let borrowed_node = n.borrow();
                let (left_rob, left_not_rob) = rob_helper(borrowed_node.left.clone());
                let (right_rob, right_not_rob) = rob_helper(borrowed_node.right.clone());
                let rob_current = borrowed_node.val + left_not_rob + right_not_rob;
                let not_rob_current = left_rob.max(left_not_rob) + right_rob.max(right_not_rob);
                (rob_current, not_rob_current)
            } else {
                (0, 0)
            }
        }
        let (rob_root, not_rob_root) = rob_helper(root);
        rob_root.max(not_rob_root)
    }
}
// @lc code=end

/*
// @lcpr case=start
// [3,2,3,null,3,null,1]\n
// @lcpr case=end

// @lcpr case=start
// [3,4,5,1,3,null,1]\n
// @lcpr case=end

 */
