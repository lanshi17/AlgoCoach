/*
 * @lc app=leetcode.cn id=519 lang=rust
 * @lcpr version=30300
 *
 * [519] 随机翻转矩阵
 */

// @lc code=start
use std::collections::{HashSet,HashMap};
use rand::Rng;
struct Solution {
    m:i32,
    n:i32,
    total:i32,
    flipped_indics:HashSet<i32>,
    virtual_to_actual:HashMap<i32,i32>,
}


/** 
 * `&self` means the method takes an immutable reference.
 * If you need a mutable reference, change it to `&mut self` instead.
 */
impl Solution {

    fn new(m: i32, n: i32) -> Self {
        Self{
            m:m,
            n:n,
            total:m*n,
            flipped_indics:HashSet::new(),
            virtual_to_actual:HashMap::new(),
        }
    }
    
    fn flip(&mut self) -> Vec<i32> {
        if self.total<=0{
            return vec![];
        }
        let rand_idx=rand::thread_rng().gen_range(0..self.total);
        self.total-=1;
        let idx_to_return=*self.virtual_to_actual.get(&rand_idx).unwrap_or(&rand_idx);
        let last_idx=*self.virtual_to_actual.get(&self.total).unwrap_or(&self.total);
        self.virtual_to_actual.insert(rand_idx,last_idx);
        let row=idx_to_return/self.n;
        let col=idx_to_return%self.n;
        self.flipped_indics.insert(idx_to_return);
        vec![row,col]
    }
    
    fn reset(&mut self) {
        self.total=self.n*self.m;
        self.virtual_to_actual.clear();
        self.flipped_indics.clear();
    }
}

/**
 * Your Solution object will be instantiated and called as such:
 * let obj = Solution::new(m, n);
 * let ret_1: Vec<i32> = obj.flip();
 * obj.reset();
 */
// @lc code=end



