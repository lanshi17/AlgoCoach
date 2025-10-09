/*
 * @lc app=leetcode.cn id=449 lang=rust
 * @lcpr version=30203
 *
 * [449] 序列化和反序列化二叉搜索树
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
struct Codec {}

impl Codec {
    fn new() -> Self {
        Codec {}
    }

    fn serialize(&self, root: Option<Rc<RefCell<TreeNode>>>) -> String {
        let mut values = Vec::new();
        Self::collect_preorder(&root, &mut values);
        values
            .iter()
            .map(|v| v.to_string())
            .collect::<Vec<_>>()
            .join(",")
    }
    
    fn collect_preorder(
        root: &Option<Rc<RefCell<TreeNode>>>,
        values: &mut Vec<i32>,
    ) {
        if let Some(node) = root {
            let node_ref = node.borrow();
            values.push(node_ref.val);
            Self::collect_preorder(&node_ref.left, values);
            Self::collect_preorder(&node_ref.right, values);
        }
    }
    
    fn deserialize(&self, data: String) -> Option<Rc<RefCell<TreeNode>>> {
        if data.is_empty() {
            return None;
        }
        let values: Vec<i32> = data
            .split(",")
            .filter_map(|s| s.parse().ok())
            .collect();
        if values.is_empty() {
            return None;
        }
        let mut idx = 0usize;
        Self::build_bst(&values, &mut idx, i64::MIN, i64::MAX)
    }

    fn build_bst(
        values: &[i32], 
        index: &mut usize, 
        lower: i64, 
        upper: i64
    ) -> Option<Rc<RefCell<TreeNode>>> {
        if *index >= values.len() {
            return None;
        }
        
        let val_i64 = values[*index] as i64;
        if val_i64 < lower || val_i64 > upper {
            return None;
        }
        
        *index += 1;
        let node = Rc::new(RefCell::new(TreeNode::new(val_i64 as i32)));
        node.borrow_mut().left = Self::build_bst(values, index, lower, val_i64 - 1);
        node.borrow_mut().right = Self::build_bst(values, index, val_i64 + 1, upper);
        Some(node)
    }
}

/**
 * Your Codec object will be instantiated and called as such:
 * let obj = Codec::new();
 * let data: String = obj.serialize(strs);
 * let ans: Option<Rc<RefCell<TreeNode>>> = obj.deserialize(data);
 */
// @lc code=end



/*
// @lcpr case=start
// [2,1,3]\n
// @lcpr case=end

// @lcpr case=start
// []\n
// @lcpr case=end

 */

