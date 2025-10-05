/*
 * @lc app=leetcode.cn id=501 lang=rust
 * @lcpr version=30203
 *
 * [501] 二叉搜索树中的众数
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
use std::collections::HashMap;
struct TraversalState{
    cur_val:Option<i32>,
    cur_count:i32,
    max_count:i32,
}
impl TraversalState{
    fn new()->Self{
        TraversalState{
            cur_val:None,
            cur_count:0,
            max_count:0,
        }
    }
}
impl Solution {
    pub fn find_mode(root: Option<Rc<RefCell<TreeNode>>>) -> Vec<i32> {
        let mut modes=Vec::new();
        let mut state=TraversalState::new();
        Self::inoder(&root,&mut state,&mut modes);
        modes
    }
    fn inoder(
        node:&Option<Rc<RefCell<TreeNode>>>,
        state:&mut TraversalState,
        modes:&mut Vec<i32>,
    ){
        if let Some(n)=node{
            Self::inoder(&n.borrow().left,state,modes);
            let val=n.borrow().val;
            if state.cur_val==Some(val){
                state.cur_count+=1;
            }else{
                state.cur_val=Some(val);
                state.cur_count=1;
            }
            if state.cur_count>state.max_count{
                state.max_count=state.cur_count;
                modes.clear();
                modes.push(val);
            }else if state.cur_count==state.max_count{
                modes.push(val);
            }
            Self::inoder(&n.borrow().right,state,modes);
        }
    }
}
// @lc code=end



/*
// @lcpr case=start
// [1,null,2,2]\n
// @lcpr case=end

// @lcpr case=start
// [0]\n
// @lcpr case=end

 */

