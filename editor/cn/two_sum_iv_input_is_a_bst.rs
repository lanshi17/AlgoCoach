/*
 * @lc app=leetcode.cn id=653 lang=rust
 * @lcpr version=30203
 *
 * [653] 两数之和 IV - 输入二叉搜索树
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
use std::collections::HashSet;
impl Solution {
    pub fn find_target(root: Option<Rc<RefCell<TreeNode>>>, k: i32) -> bool {
        let mut seen=HashSet::new();
        Self::dfs(&root,k,&mut seen)
    }
    fn dfs(
        node:&Option<Rc<RefCell<TreeNode>>>,
        k:i32,
        seen:&mut HashSet<i32>,
    )->bool{
        if let Some(n)=node{
            let n_ref=n.borrow();
            if seen.contains(&(k-n_ref.val)){
                return true;
            }
            seen.insert(n_ref.val);
            return Self::dfs(&n_ref.left.clone(),k,seen)||
                    Self::dfs(&n_ref.right.clone(),k,seen);
        }
        false
    }
}
// @lc code=end



/*
// @lcpr case=start
// [5,3,6,2,4,null,7]\n9\n
// @lcpr case=end

// @lcpr case=start
// [5,3,6,2,4,null,7]\n28\n
// @lcpr case=end

 */

