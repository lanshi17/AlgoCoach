/*
 * @lc app=leetcode.cn id=968 lang=rust
 * @lcpr version=30203
 *
 * [968] 监控二叉树
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
    pub fn min_camera_cover(root: Option<Rc<RefCell<TreeNode>>>) -> i32 {
       if let Some(node) = root {
            let mut res = 0;
            let state = Self::dfs(&Some(node), &mut res);
            // 如果根节点未被覆盖，需要在根节点放置摄像头
            if state == 0 {
                res += 1;
            }
            res
       } else {
            0
       }
    }
    
    // 返回状态：0-未被覆盖，1-被覆盖但没有摄像头，2-有摄像头
    fn dfs(node: &Option<Rc<RefCell<TreeNode>>>, res: &mut i32) -> i32 {
        match node {
            None => 1, // 空节点视为被覆盖
            Some(n) => {
                let n_ref = n.borrow();
                let left = Self::dfs(&n_ref.left, res);
                let right = Self::dfs(&n_ref.right, res);
                
                // 如果任一子节点未被覆盖，当前节点必须放摄像头
                if left == 0 || right == 0 {
                    *res += 1;
                    2 // 当前节点有摄像头
                }
                // 如果任一子节点有摄像头，当前节点被覆盖
                else if left == 2 || right == 2 {
                    1 // 被覆盖但没有摄像头
                }
                // 如果两个子节点都被覆盖但都没有摄像头，当前节点未被覆盖
                else {
                    0 // 未被覆盖
                }
            }
        }
    }
}
// @lc code=end



/*
// @lcpr case=start
// [0,0,null,0,0]\n
// @lcpr case=end

// @lcpr case=start
// [0,0,null,0,null,0,null,null,0]\n
// @lcpr case=end

 */

