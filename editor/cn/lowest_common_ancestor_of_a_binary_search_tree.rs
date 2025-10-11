/*
 * @lc app=leetcode.cn id=235 lang=rust
 * @lcpr version=30203
 *
 * [235] 二叉搜索树的最近公共祖先
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
    pub fn lowest_common_ancestor(root: Option<Rc<RefCell<TreeNode>>>, p: Option<Rc<RefCell<TreeNode>>>, q: Option<Rc<RefCell<TreeNode>>>) -> Option<Rc<RefCell<TreeNode>>> {
       let mut p_val=p.as_ref()?.borrow().val;
       let mut q_val=q.as_ref()?.borrow().val;
       Self::find_lca_bst(&root,p_val,q_val)
    }
    fn find_lca_bst(root:&Option<Rc<RefCell<TreeNode>>>,
        val1:i32,
        val2:i32,
        ) ->Option<Rc<RefCell<TreeNode>>>{
            if let Some(node)=root{
                let node_val=node.borrow().val;
                if val1<node_val&&val2<node_val{
                    return Self::find_lca_bst(&node.borrow().left,val1,val2);
                }
                if val1>node_val&&val2>node_val{
                    return Self::find_lca_bst(&node.borrow().right,val1,val2);
                }
                Some(node.clone())
            }else {None}
        }
}
// @lc code=end



/*
// @lcpr case=start
// [6,2,8,0,4,7,9,null,null,3,5]\n2\n8\n
// @lcpr case=end

// @lcpr case=start
// [6,2,8,0,4,7,9,null,null,3,5]\n2\n4\n
// @lcpr case=end

 */

