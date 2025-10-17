/*
 * @lc app=leetcode.cn id=380 lang=rust
 * @lcpr version=30203
 *
 * [380] O(1) 时间插入、删除和获取随机元素
 */

// @lc code=start
use std::collections::hash_map::{Entry,HashMap};
use rand::Rng;
struct RandomizedSet {
    vals:Vec<i32>,
    indics:HashMap<i32,usize>,
}

/** 
 * `&self` means the method takes an immutable reference.
 * If you need a mutable reference, change it to `&mut self` instead.
 */
impl RandomizedSet {

    fn new() -> Self {
        Self{
            vals:Vec::new(),
            indics:HashMap::new(),
        }     
    }
    
    fn insert(&mut self, val: i32) -> bool {
        match self.indics.entry(val){
            Entry::Vacant(entry)=>{
                let index=self.vals.len();
                self.vals.push(val);
                entry.insert(index);
                true
            },
            Entry::Occupied(_)=>false,
        }
    }
    
    fn remove(&mut self, val: i32) -> bool {
        match self.indics.remove_entry(&val){
            Some((_,index))=>{
                let last_index=self.vals.len()-1;
                let last_val=self.vals[last_index];
                self.vals[index]=last_val;
                if index!=last_index{
                    self.indics.insert(last_val,index);
                }
                self.vals.pop();
                true
            },
            None=>false,
        }
    }
    
    fn get_random(&self) -> i32 {
        let index=rand::thread_rng().gen_range(0..self.vals.len());
        self.vals[index]

    }
}

/**
 * Your RandomizedSet object will be instantiated and called as such:
 * let obj = RandomizedSet::new();
 * let ret_1: bool = obj.insert(val);
 * let ret_2: bool = obj.remove(val);
 * let ret_3: i32 = obj.get_random();
 */
// @lc code=end



