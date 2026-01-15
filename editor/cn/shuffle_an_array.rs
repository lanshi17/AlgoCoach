/*
 * @lc app=leetcode.cn id=384 lang=rust
 * @lcpr version=30306
 *
 * [384] 打乱数组
 */

// @lc code=start
use rand::Rng;
use rand::seq::SliceRandom;
struct Solution {
    nums:Vec<i32>,
    rng: rand::rngs::ThreadRng,
}


/** 
 * `&self` means the method takes an immutable reference.
 * If you need a mutable reference, change it to `&mut self` instead.
 */
impl Solution {

    fn new(nums: Vec<i32>) -> Self {
        Self{
            nums:nums,
            rng:rand::thread_rng()
        }
    }
    
    fn reset(&self) -> Vec<i32> {
        self.nums.clone()
    }
    
    fn shuffle(&mut self) -> Vec<i32> {
        let mut copy=self.nums.clone();
        copy.shuffle(&mut self.rng);
        copy
    }
}

/**
 * Your Solution object will be instantiated and called as such:
 * let obj = Solution::new(nums);
 * let ret_1: Vec<i32> = obj.reset();
 * let ret_2: Vec<i32> = obj.shuffle();
 */
// @lc code=end



/*
// @lcpr case=start
// ["Solution","shuffle","reset","shuffle"]\n[[[1,2,3]],[],[],[]]\n
// @lcpr case=end

 */

