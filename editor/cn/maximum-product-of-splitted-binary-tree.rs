/*
 * @lc app=leetcode.cn id=1339 lang=rust
 * @lcpr version=30203
 *
 * [1339] 分裂二叉树的最大乘积
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
    pub fn max_product(root: Option<Rc<RefCell<TreeNode>>>) -> i32 {
        const MOD:i64=1_000_000_007;
        let mut subtree_sums=Vec::new();
        fn cal_subtree_sums(node:&Option<Rc<RefCell<TreeNode>>>,sums:&mut Vec<i64>)->i64{
            match node{
                None=>0,
                Some(n)=>{
                    let n_ref=n.borrow();
                    let left_sum=cal_subtree_sums(&n_ref.left,sums);
                    let right_sum=cal_subtree_sums(&n_ref.right,sums);
                    let cur_sum=n_ref.val as i64+left_sum+right_sum;
                    sums.push(cur_sum);
                    cur_sum
                }
            }
        }
        cal_subtree_sums(&root,&mut subtree_sums);
        let total_sums=subtree_sums.last().unwrap_or(&0);
        let mut max_product:i64=0;
        for &subtree_sum in subtree_sums.iter().take(subtree_sums.len()-1){
            let product=subtree_sum*(total_sums-subtree_sum);
            max_product=max_product.max(product);
        } 
        (max_product%MOD) as i32


    }
}
// @lc code=end



/*
// @lcpr case=start
// [1,2,3,4,5,6]\n
// @lcpr case=end

// @lcpr case=start
// [1,null,2,3,4,null,null,5,6]\n
// @lcpr case=end

// @lcpr case=start
// [2,3,9,10,7,8,6,5,4,11,1]\n
// @lcpr case=end

// @lcpr case=start
// [1,1]\n
// @lcpr case=end

 */

