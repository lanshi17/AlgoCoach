/*
 * @lc app=leetcode.cn id=398 lang=rust
 * @lcpr version=30306
 *
 * [398] 随机数索引
 */

use std::collections::HashMap;
use rand::Rng;

struct Solution {
    num_to_indices: HashMap<i32, Vec<i32>>,
}


/** 
 * `&self` means the method takes an immutable reference.
 * If you need a mutable reference, change it to `&mut self` instead.
 */
impl Solution {

    fn new(nums: Vec<i32>) -> Self {
        let mut num_to_indices: HashMap<i32, Vec<i32>> = HashMap::new();
        
        for (i, num) in nums.iter().enumerate() {
            num_to_indices.entry(*num).or_insert_with(Vec::new).push(i as i32);
        }
        
        Self {
            num_to_indices,
        }
    }
    
    fn pick(&self, target: i32) -> i32 {
        let indices = &self.num_to_indices[&target];
        let random_idx = rand::thread_rng().gen_range(0..indices.len());
        indices[random_idx]
    }
}

/**
 * Your Solution object will be instantiated and called as such:
 * let obj = Solution::new(nums);
 * let ret_1: i32 = obj.pick(target);
 */
// @lc code=end



/*
// @lcpr case=start
// ["Solution","pick","pick","pick"]\n[[[1,2,3,3,3]],[3],[1],[3]]\n
// @lcpr case=end

 */

