/*
 * @lc app=leetcode.cn id=1609 lang=rust
 * @lcpr version=30203
 *
 * [1609] 奇偶树
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
use std::collections::VecDeque;
impl Solution {
    pub fn is_even_odd_tree(root: Option<Rc<RefCell<TreeNode>>>) -> bool {
        let root_node=match root{
            Some(node)=>node,
            None=>return true,
        };
        let mut q=VecDeque::new();
        q.push_back(root_node);
        let mut level=0;
        while !q.is_empty(){
            let level_size=q.len();
            let mut pre_val:Option<i32>=None;
            for _ in 0..level_size{
                if let Some(node)=q.pop_front(){
                    let node_ref=node.borrow();
                    let is_val_even=node_ref.val%2==0;
                    let is_level_even=level%2==0;
                    if is_val_even&&is_level_even{
                        return false;
                    }
                    if !is_val_even&&!is_level_even{
                        return false;
                    }
                    if let Some(pv)=pre_val{
                        if is_level_even&&pv>=node_ref.val{
                            return false;
                        }
                        if !is_level_even&&pv<=node_ref.val{
                            return false;
                        }
                    }
                    pre_val=Some(node_ref.val);
                    if let Some(left)=node_ref.left.as_ref(){
                        q.push_back(left.clone());
                    }
                    if let Some(right)=node_ref.right.as_ref(){
                        q.push_back(right.clone());
                    }
                }
            }
            level+=1;
        }
        true
    }
}
// @lc code=end



/*
// @lcpr case=start
// [1,10,4,3,null,7,9,12,8,6,null,null,2]\n
// @lcpr case=end

// @lcpr case=start
// [5,4,2,3,3,7]\n
// @lcpr case=end

// @lcpr case=start
// [5,9,1,3,5,7]\n
// @lcpr case=end

// @lcpr case=start
// [1]\n
// @lcpr case=end

// @lcpr case=start
// [11,8,6,1,3,9,11,30,20,18,16,12,10,4,2,17]\n
// @lcpr case=end

 */

