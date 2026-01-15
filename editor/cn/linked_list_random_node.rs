/*
 * @lc app=leetcode.cn id=382 lang=rust
 * @lcpr version=30306
 *
 * [382] 链表随机节点
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
use rand::Rng;
struct Solution {
    head:Option<Box<ListNode>>,
    rng:rand::rngs::ThreadRng,
}


/** 
 * `&self` means the method takes an immutable reference.
 * If you need a mutable reference, change it to `&mut self` instead.
 */
impl Solution {

    fn new(head: Option<Box<ListNode>>) -> Self {
        Self{
            head,
            rng:rand::thread_rng(),
        }
    }
    
    fn get_random(&mut self) -> i32 {
        let mut res=0;
        let mut cur=self.head.as_ref();
        let mut count=0;
        while let Some(node)=cur{
            count+=1;
            if self.rng.gen_range(1..=count)==1{
                res=node.val;
            }
            cur=node.next.as_ref();
        }
        res
    }
}

/**
 * Your Solution object will be instantiated and called as such:
 * let obj = Solution::new(head);
 * let ret_1: i32 = obj.get_random();
 */
// @lc code=end



/*
// @lcpr case=start
// ["Solution","getRandom","getRandom","getRandom","getRandom","getRandom"]\n[[[1,2,3]],[],[],[],[],[]]\n
// @lcpr case=end

 */

