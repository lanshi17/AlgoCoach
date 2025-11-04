/*
 * @lc app=leetcode.cn id=855 lang=rust
 * @lcpr version=30301
 *
 * [855] 考场就座
 */

// @lc code=start
use std::collections::BTreeSet;
#[derive(Default)]
struct ExamRoom {
    n:i32,
    occupied:BTreeSet<i32>,
}


/** 
 * `&self` means the method takes an immutable reference.
 * If you need a mutable reference, change it to `&mut self` instead.
 */
impl ExamRoom {

    fn new(n: i32) -> Self {
       Self { n, ..Default::default() }
    }
    
    fn seat(&mut self) -> i32 {
        if self.occupied.is_empty(){
            self.occupied.insert(0);
            return 0;
        }
        let mut max_dist=0;
        let mut seat=0;
        if let Some(&first)=self.occupied.first(){
            if first!=0{
                max_dist=first;
                seat=0;
            }
        }
        let mut prev:Option<i32> =None;
        for &pos in &self.occupied{
            if let Some(p)=prev{
                let dist=(pos-p)/2;
                if dist>max_dist{
                    max_dist=dist;
                    seat=p+dist;
                }
            }
            prev=Some(pos);
        }
        if let Some(&last)=self.occupied.last(){
            let dist=self.n-1-last;
            if dist>max_dist{
                max_dist=dist;
                seat=self.n-1;
            }
        }
        self.occupied.insert(seat);
        seat
    }
    
    fn leave(&mut self, p: i32) {
        self.occupied.remove(&p);
    }
}

/**
 * Your ExamRoom object will be instantiated and called as such:
 * let obj = ExamRoom::new(n);
 * let ret_1: i32 = obj.seat();
 * obj.leave(p);
 */
// @lc code=end



/*
// @lcpr case=start
// ["ExamRoom", "seat", "seat", "seat", "seat", "leave", "seat"]\n[[10], [], [], [], [], [4], []]\n
// @lcpr case=end

 */

