/*
 * @lc app=leetcode.cn id=729 lang=rust
 * @lcpr version=30300
 *
 * [729] 我的日程安排表 I
 */

// @lc code=start
use std::collections::BTreeMap;
#[derive(Default)]
struct MyCalendar {
    map:BTreeMap<i32,i32>,
}


/** 
 * `&self` means the method takes an immutable reference.
 * If you need a mutable reference, change it to `&mut self` instead.
 */
impl MyCalendar {

    fn new() -> Self {
        Default::default()
    }
    
    fn book(&mut self, start_time: i32, end_time: i32) -> bool {
        if let Some((_,&prev_end_time))=self.map.range(..end_time).next_back(){
            if prev_end_time>start_time{
                return false;
            }
        }
        self.map.insert(start_time,end_time);
        true
    }
}

/**
 * Your MyCalendar object will be instantiated and called as such:
 * let obj = MyCalendar::new();
 * let ret_1: bool = obj.book(startTime, endTime);
 */
// @lc code=end



/*
// @lcpr case=start
// ["MyCalendar", "book", "book", "book"]\n[[], [10, 20], [15, 25], [20, 30]]\n
// @lcpr case=end

 */

