/*
 * @lc app=leetcode.cn id=1161 lang=rust
 * @lcpr version=30203
 *
 * [1161] 最大层内元素和
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
    pub fn max_level_sum(root: Option<Rc<RefCell<TreeNode>>>) -> i32 {
        if root.is_none(){
            return 0;
        }
        let mut max_sum=i32::MIN;
        let mut max_level=1;
        let mut cur_level=1;
        let mut q=VecDeque::new();
        q.push_back(root.unwrap());
        while !q.is_empty(){
            let level_size=q.len();
            let mut cur_sum=0;
            for _ in 0..level_size{
                if let Some(node)=q.pop_front(){
                    let node_ref=node.borrow();
                    cur_sum+=node_ref.val;
                    if let Some(left)=node_ref.left.as_ref(){
                        q.push_back(left.clone());
                    }
                    if let Some(right)=node_ref.right.as_ref(){
                        q.push_back(right.clone());
                    }
                }
            }
            if max_sum<cur_sum{
                max_sum=cur_sum;
                max_level=cur_level;
            }
            cur_level+=1;
        }
        max_level
    }
}
// @lc code=end



/*
// @lcpr case=start
// [1,7,0,7,-8,null,null]\n
// @lcpr case=end

// @lcpr case=start
// [989,null,10250,98693,-89388,null,null,null,-32127]\n
// @lcpr case=end

 */

