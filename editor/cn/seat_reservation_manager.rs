/*
 * @lc app=leetcode.cn id=1845 lang=rust
 * @lcpr version=30300
 *
 * [1845] 座位预约管理系统
 */

// @lc code=start
use std::collections::{HashMap,BinaryHeap};
use std::cmp::Reverse;
struct SeatManager {
    min_heap:BinaryHeap<Reverse<i32>>,
}


/** 
 * `&self` means the method takes an immutable reference.
 * If you need a mutable reference, change it to `&mut self` instead.
 */
impl SeatManager {

    fn new(n: i32) -> Self {
        let mut min_heap:BinaryHeap<Reverse<i32>>=(1..=n).map(Reverse).collect();
        Self{
            min_heap,
        }
    }
    
    fn reserve(&mut self) -> i32 {
        if let Some(set_seat)=self.min_heap.pop(){
            set_seat.0
        }else{
            0
        }
    }
    
    fn unreserve(&mut self, seat_number: i32) {
        self.min_heap.push(Reverse(seat_number));
    }
}

/**
 * Your SeatManager object will be instantiated and called as such:
 * let obj = SeatManager::new(n);
 * let ret_1: i32 = obj.reserve();
 * obj.unreserve(seatNumber);
 */
// @lc code=end



/*
// @lcpr case=start
// ["SeatManager", "reserve", "reserve", "unreserve", "reserve", "reserve", "reserve", "reserve", "unreserve"]\n[[5], [], [], [2], [], [], [], [], [5]]\n
// @lcpr case=end

 */

