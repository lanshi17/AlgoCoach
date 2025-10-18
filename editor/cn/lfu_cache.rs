/*
 * @lc app=leetcode.cn id=460 lang=rust
 * @lcpr version=30203
 *
 * [460] LFU 缓存
 */

// @lc code=start
use std::collections::{HashMap,LinkedList};
struct LFUCache {
    key_to_val:HashMap<i32,i32>,
    key_to_freq:HashMap<i32,i32>,
    freq_to_keys:HashMap<i32,LinkedList<i32>>,
    min_freq:i32,
    cap:usize,
}


/** 
 * `&self` means the method takes an immutable reference.
 * If you need a mutable reference, change it to `&mut self` instead.
 */
impl LFUCache {

    fn new(capacity: i32) -> Self {
        Self{
            key_to_val:HashMap::new(),
            key_to_freq:HashMap::new(),
            freq_to_keys:HashMap::new(),
            min_freq:0,
            cap:capacity as usize,
        }
    }
    
    fn get(&mut self, key: i32) -> i32 {
        if !self.key_to_val.contains_key(&key){
            return -1;
        }    
        self.increase_freq(key);
        *self.key_to_val.get(&key).unwrap()
    }
    
    fn put(&mut self, key: i32, value: i32) {
        if self.cap<=0{
            return;
        }    
        if self.key_to_val.contains_key(&key){
            self.key_to_val.insert(key,value);
            self.increase_freq(key);
            return;
        }
        if self.key_to_val.len()>=self.cap{
            self.remove_min_freq_key();
        }
        self.key_to_val.insert(key,value);
        self.key_to_freq.insert(key,1);
        self.freq_to_keys.entry(1).or_insert_with(LinkedList::new).push_back(key);
        self.min_freq=1;    
    }
    fn increase_freq(&mut self, key: i32) {
        if let Some(freq) = self.key_to_freq.get(&key).copied() {
            let new_freq = freq + 1;
            self.key_to_freq.insert(key, new_freq);
            if let Some(old_list) = self.freq_to_keys.get_mut(&freq) {
                let mut new_list = LinkedList::new();
                for k in old_list.iter() {
                    if *k != key {
                        new_list.push_back(*k);
                    }
                }
                if new_list.is_empty() {
                    self.freq_to_keys.remove(&freq);
                    if self.min_freq == freq {
                        self.min_freq = freq + 1;
                    }
                } else {
                    *old_list = new_list;
                }
            }
            self.freq_to_keys.entry(new_freq).or_insert_with(LinkedList::new).push_back(key);
        }
    }
    fn remove_min_freq_key(&mut self){
        if let Some(key_list)=self.freq_to_keys.get_mut(&self.min_freq){
            if let Some(deleted_key)=key_list.pop_front(){
                if key_list.is_empty(){
                    self.freq_to_keys.remove(&self.min_freq);
                }
                self.key_to_freq.remove(&deleted_key);
                self.key_to_val.remove(&deleted_key);
            }
        }
    }
}

/**
 * Your LFUCache object will be instantiated and called as such:
 * let obj = LFUCache::new(capacity);
 * let ret_1: i32 = obj.get(key);
 * obj.put(key, value);
 */
// @lc code=end



/*
// @lcpr case=start
// ["LFUCache", "put", "put", "get", "put", "get", "get", "put", "get", "get", "get"]\n[[2], [1, 1], [2, 2], [1], [3, 3], [2], [3], [4, 4], [1], [3], [4]]\n
// @lcpr case=end

 */

