/*
 * @lc app=leetcode.cn id=677 lang=rust
 * @lcpr version=30301
 *
 * [677] 键值映射
 */

// @lc code=start
use std::collections::HashMap;
#[derive(Default)]
struct MapSum {
    map:HashMap<String,i32>,
}


/** 
 * `&self` means the method takes an immutable reference.
 * If you need a mutable reference, change it to `&mut self` instead.
 */
impl MapSum {

    fn new() -> Self {
        Self{
            map:HashMap::new()
        }
    }
    
    fn insert(&mut self, key: String, val: i32) {
        if let Some(x)=self.map.get_mut(&key){
            *x=val;
        }else{
            self.map.insert(key,val);
        }
    }
    
    fn sum(&mut self, prefix: String) -> i32 {
        let mut res=0;
        for (k,v) in &self.map{
            if k.starts_with(&prefix){
                res+=v;
            }
        }
        res
    }
}

/**
 * Your MapSum object will be instantiated and called as such:
 * let obj = MapSum::new();
 * obj.insert(key, val);
 * let ret_2: i32 = obj.sum(prefix);
 */
// @lc code=end



/*
// @lcpr case=start
// ["MapSum", "insert", "sum", "insert", "sum"]\n[[], ["apple", 3], ["ap"], ["app", 2], ["ap"]]\n
// @lcpr case=end

 */

