/*
 * @lc app=leetcode.cn id=710 lang=rust
 * @lcpr version=30203
 *
 * [710] 黑名单中的随机数
 */

// @lc code=start
use std::collections::{HashMap,HashSet};
use rand::Rng;
struct Solution {
    sz:i32,
    mapping:HashMap<i32,i32>,
    blacklist:HashSet<i32>,

}


/** 
 * `&self` means the method takes an immutable reference.
 * If you need a mutable reference, change it to `&mut self` instead.
 */
impl Solution {

    fn new(n: i32, blacklist: Vec<i32>) -> Self {
        let sz=n -blacklist.len() as i32;
        let blacklist_set:HashSet<i32>=blacklist.into_iter().collect();
        let mut mapping:HashMap<i32,i32>=HashMap::new();
        let mut last=(n-1);
        for &i in &blacklist_set{
            if i>=sz{
                continue;
            }
            while blacklist_set.contains(&last){
                last-=1;
            }
            mapping.insert(i,last);
            last-=1;
        }
        Self{
            sz:sz,
            mapping:mapping,
            blacklist:blacklist_set,
        }
    }
    
    fn pick(&self) -> i32 {
        let index=rand::thread_rng().gen_range(0..self.sz);
        *self.mapping.get(&index).unwrap_or(&index)
        
    }
}

/**
 * Your Solution object will be instantiated and called as such:
 * let obj = Solution::new(n, blacklist);
 * let ret_1: i32 = obj.pick();
 */
// @lc code=end



