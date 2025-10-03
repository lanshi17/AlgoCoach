/*
 * @lc app=leetcode.cn id=863 lang=rust
 * @lcpr version=30203
 *
 * [863] 二叉树中所有距离为 K 的结点
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
use std::collections::{HashMap, HashSet};
use std::rc::Rc;
impl Solution {
    pub fn distance_k(
        root: Option<Rc<RefCell<TreeNode>>>,
        target: Option<Rc<RefCell<TreeNode>>>,
        k: i32,
    ) -> Vec<i32> {
        if root.is_none() || target.is_none() {
            return vec![];
        }
        if k == 0 {
            return vec![target.as_ref().unwrap().borrow().val];
        }
        let mut parent_map: HashMap<*const RefCell<TreeNode>, Rc<RefCell<TreeNode>>> =
            HashMap::new();
        let mut found_target: Option<Rc<RefCell<TreeNode>>> = None;
        Self::find_parents_and_target(&root, &mut parent_map, &target, &mut found_target);
        let target_node = match found_target {
            Some(node) => node,
            None => return vec![],
        };
        let mut res = Vec::new();
        let mut visited: HashSet<*const RefCell<TreeNode>> = HashSet::new();
        Self::find_downwards(&target_node, k, &mut res, &mut visited, std::ptr::null());
        let mut cur = target_node.clone();
        let mut steps = 0;
        while steps < k {
            let cur_ptr: *const RefCell<TreeNode> = Rc::as_ptr(&cur);
            if let Some(parent_rc) = parent_map.get(&cur_ptr) {
                steps += 1;
                let parent_ptr: *const RefCell<TreeNode> = Rc::as_ptr(parent_rc);
                if steps == k {
                    res.push(parent_rc.borrow().val);
                } else {
                    Self::find_downwards(parent_rc, k - steps, &mut res, &mut visited, cur_ptr);
                }
                cur = parent_rc.clone();
            } else {
                break;
            }
        }
        res
    }
    fn find_parents_and_target(
        node: &Option<Rc<RefCell<TreeNode>>>,
        parent_map: &mut HashMap<*const RefCell<TreeNode>, Rc<RefCell<TreeNode>>>,
        target: &Option<Rc<RefCell<TreeNode>>>,
        found_target: &mut Option<Rc<RefCell<TreeNode>>>,
    ) {
        if let Some(cur_node) = node {
            if target.as_ref().map_or(false, |t| Rc::ptr_eq(t, cur_node)) {
                *found_target = Some(cur_node.clone());
            }
            let _cur_ptr: *const RefCell<TreeNode> = Rc::as_ptr(cur_node);
            if let Some(left) = &cur_node.borrow().left {
                parent_map.insert(Rc::as_ptr(left), cur_node.clone());
                Self::find_parents_and_target(
                    &Some(left.clone()),
                    parent_map,
                    target,
                    found_target,
                );
            }
            if let Some(right) = &cur_node.borrow().right {
                parent_map.insert(Rc::as_ptr(right), cur_node.clone());
                Self::find_parents_and_target(
                    &Some(right.clone()),
                    parent_map,
                    target,
                    found_target,
                );
            }
        }
    }
    fn find_downwards(
        node: &Rc<RefCell<TreeNode>>,
        dist: i32,
        res: &mut Vec<i32>,
        visited: &mut HashSet<*const RefCell<TreeNode>>,
        from_ptr: *const RefCell<TreeNode>,
    ) {
        let cur_ptr: *const RefCell<TreeNode> = Rc::as_ptr(node);
        if visited.contains(&cur_ptr) {
            return;
        }
        visited.insert(cur_ptr);
        if dist == 0 {
            res.push(node.borrow().val);
            return;
        }
        if let Some(left) = &node.borrow().left {
            let left_ptr = Rc::as_ptr(left);
            if left_ptr != from_ptr {
                Self::find_downwards(left, dist - 1, res, visited, cur_ptr);
            }
        }
        if let Some(right) = &node.borrow().right {
            let right_ptr = Rc::as_ptr(right);
            if right_ptr != from_ptr {
                Self::find_downwards(right, dist - 1, res, visited, cur_ptr);
            }
        }
    }
}
// @lc code=end

/*
// @lcpr case=start
// [3,5,1,6,2,0,8,null,null,7,4]\n5\n2\n
// @lcpr case=end

// @lcpr case=start
// [1]\n1\n3\n
// @lcpr case=end

 */
