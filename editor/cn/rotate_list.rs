/*
 * @lc app=leetcode.cn id=61 lang=rust
 * @lcpr version=30305
 *
 * [61] 旋转链表
 */

// @lc code=start
// Definition for singly-linked list.
// #[derive(PartialEq, Eq, Clone, Debug)]
// pub struct ListNode {
//   pub val: i32,
//   pub next: Option<Box<ListNode>>
// }
//
// impl ListNode {
//   #[inline]
//   fn new(val: i32) -> Self {
//     ListNode {
//       next: None,
//       val
//     }
//   }
// }
impl Solution {
    /// 旋转链表，将每个节点向右移动 k 个位置。
    ///
    /// # Arguments
    /// * `head` - 链表的头节点。
    /// * `k` - 向右移动的位置数。
    ///
    /// # Returns
    /// 返回旋转后链表的头节点。
    pub fn rotate_right(head: Option<Box<ListNode>>, k: i32) -> Option<Box<ListNode>> {
        if head.is_none() || k == 0 {
            return head;
        }
        let mut head = head;
        let mut ptr = &head;
        let mut len = 0;
        while let Some(t) = ptr {
            ptr = &t.next;
            len += 1;
        }
        let k = k % len;
        if k == 0 {
            return head;
        }
        let mut ptr = &mut head;
        for _ in 1..len - k {
            ptr = &mut ptr.as_mut().unwrap().next;
        }
        let mut new_head = ptr.as_mut().unwrap().next.take();
        let mut tail = &mut new_head;
        while tail.is_some() && tail.as_ref().unwrap().next.is_some() {
            tail = &mut tail.as_mut().unwrap().next;
        }
        tail.as_mut().unwrap().next = head;
        new_head
    }
}
// @lc code=end

/*
// @lcpr case=start
// [1,2,3,4,5]\n2\n
// @lcpr case=end

// @lcpr case=start
// [0,1,2]\n4\n
// @lcpr case=end

 */
