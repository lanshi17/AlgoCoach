/*
 * @lc app=leetcode.cn id=703 lang=rust
 * @lcpr version=30300
 *
 * [703] 数据流中的第 K 大元素
 */

// @lc code=start
use std::collections::BinaryHeap;
use std::cmp::Reverse;
struct KthLargest {
    k:i32,
    heap:BinaryHeap<Reverse<i32>>,
}


/** 
 * `&self` means the method takes an immutable reference.
 * If you need a mutable reference, change it to `&mut self` instead.
 */
impl KthLargest {
    

    fn new(k: i32, nums: Vec<i32>) -> Self {
        let mut kth_largest = KthLargest { 
            k,            
            heap: BinaryHeap::new(),     
        };
        for num in nums{
            kth_largest.add(num);
        }
        kth_largest
    }
    
    fn add(&mut self, val: i32) -> i32 {
        self.heap.push(Reverse(val));
        if self.heap.len()>self.k as usize{
            self.heap.pop();
        }
        self.heap.peek().unwrap().0
    }
}

/**
 * Your KthLargest object will be instantiated and called as such:
 * let obj = KthLargest::new(k, nums);
 * let ret_1: i32 = obj.add(val);
 */
// @lc code=end



/*
// @lcpr case=start
// ["KthLargest", "add", "add", "add", "add", "add"]\n[[3, [4, 5, 8, 2]], [3], [5], [10], [9], [4]]\n
// @lcpr case=end

// @lcpr case=start
// ["KthLargest", "add", "add", "add", "add"]\n[[4, [7, 7, 7, 7, 8, 3]], [2], [10], [9], [9]]\n
// @lcpr case=end

 */

