/*
 * @lc app=leetcode.cn id=295 lang=rust
 * @lcpr version=30300
 *
 * [295] 数据流的中位数
 */

// @lc code=start
use std::collections::BinaryHeap;
use std::cmp::Reverse;
struct MedianFinder {
    max_heap:BinaryHeap<i32>,
    min_heap:BinaryHeap<Reverse<i32>>,
}


/** 
 * `&self` means the method takes an immutable reference.
 * If you need a mutable reference, change it to `&mut self` instead.
 */
impl MedianFinder {

    fn new() -> Self {
        Self{
            max_heap:BinaryHeap::new(),
            min_heap:BinaryHeap::new(),
        }
    }
    
    fn add_num(&mut self, num: i32) {
       if self.max_heap.peek().map_or(true,|&top|num<=top){
        self.max_heap.push(num);
       }else {self.min_heap.push(Reverse(num));}
       if self.max_heap.len()>self.min_heap.len()+1{
        if let Some(top)=self.max_heap.pop(){
            self.min_heap.push(Reverse(top));
        }
       }else if self.max_heap.len()+1<self.min_heap.len(){
        if let Some(Reverse(top))=self.min_heap.pop(){
            self.max_heap.push(top);
        }
       }
    }
    
    fn find_median(&self) -> f64 {
        if self.min_heap.len()>self.max_heap.len(){
            self.min_heap.peek().unwrap().0 as f64
        }else if self.min_heap.len()<self.max_heap.len(){
            *self.max_heap.peek().unwrap() as f64
        }else{
            (self.min_heap.peek().unwrap().0+*self.max_heap.peek().unwrap())as f64/2.0 as f64
        }
    }
}

/**
 * Your MedianFinder object will be instantiated and called as such:
 * let obj = MedianFinder::new();
 * obj.add_num(num);
 * let ret_2: f64 = obj.find_median();
 */
// @lc code=end



