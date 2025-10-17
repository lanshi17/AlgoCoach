/*
 * @lc app=leetcode.cn id=146 lang=rust
 * @lcpr version=30203
 *
 * [146] LRU 缓存
 */

// @lc code=start
use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
type Link<T> = Option<Rc<RefCell<Node<T>>>>;

struct Node<T> {
    key: i32,
    value: T,
    prev: Link<T>,
    next: Link<T>,
}

struct List<T> {
    head: Link<T>,
    tail: Link<T>,
}

impl<T> Node<T> {
    fn new(key: i32, value: T) -> Rc<RefCell<Self>> {
        Rc::new(RefCell::new(Node {
            key: key,
            value: value,
            prev: None,
            next: None,
        }))
    }
}

impl<T: Default> List<T> {
    fn new() -> Self {
        let head = Node::new(0, Default::default());
        let tail = Node::new(0, Default::default());
        head.borrow_mut().next = Some(tail.clone());
        tail.borrow_mut().prev = Some(head.clone());
        Self {
            head: Some(head),
            tail: Some(tail),
        }
    }

    /// 将节点添加到链表头部
    fn push_to_head(&mut self, node: Rc<RefCell<Node<T>>>) {
        let head_next = self.head.as_ref().unwrap().borrow().next.clone();
        node.borrow_mut().next = head_next.clone();
        node.borrow_mut().prev = self.head.clone();
        if let Some(next_node) = head_next.as_ref() {
            next_node.borrow_mut().prev = Some(node.clone());
        }
        self.head.as_ref().unwrap().borrow_mut().next = Some(node);
    }

    /// 从链表中移除一个节点
    fn remove_node(&mut self, node: &Rc<RefCell<Node<T>>>) {
        let prev = node.borrow().prev.clone();
        let next = node.borrow().next.clone();

        if let Some(p) = prev.as_ref() {
            p.borrow_mut().next = next.clone();
        }
        if let Some(n) = next.as_ref() {
            n.borrow_mut().prev = prev.clone();
        }
    }

    /// 移除并返回链表尾部的节点（最久未使用）
    // fn pop_from_tail(&mut self) -> Option<Rc<RefCell<Node<T>>>> {
    //     if let Some(tail) = self.tail.as_ref() {//Error
    //         if let Some(node_before_tail) = tail.borrow().prev.clone() {
    //             if Rc::ptr_eq(self.head.as_ref().unwrap(), &node_before_tail) {
    //                 return None;
    //             }
    //             self.remove_node(&node_before_tail.clone());
    //             return Some(node_before_tail);
    //         }
    //     }
    //     None
    // }
    fn pop_from_tail(&mut self) -> Option<Rc<RefCell<Node<T>>>> {
        let node_to_remove = {
            if let Some(tail) = self.tail.as_ref() {
                if let Some(node_before_tail) = tail.borrow().prev.clone() {
                    if Rc::ptr_eq(self.head.as_ref().unwrap(), &node_before_tail) {
                        return None;
                    }
                    Some(node_before_tail)
                } else {
                    None
                }
            } else {
                None
            }
        };

        match node_to_remove {
            Some(node_rc) => {
                self.remove_node(&node_rc);
                Some(node_rc)
            }
            None => None,
        }
    }


}

struct LRUCache {
    capacity: usize,
    map: HashMap<i32, Rc<RefCell<Node<i32>>>>,
    list: List<i32>,
}


/** 
 * `&self` means the method takes an immutable reference.
 * If you need a mutable reference, change it to `&mut self` instead.
 */
impl LRUCache {

    fn new(capacity: i32) -> Self {
        LRUCache{
            capacity:capacity as usize,
            map:HashMap::new(),
            list:List::new(),
        }
    }
    
    fn get(&mut self, key: i32) -> i32 {
        if let Some(node) = self.map.get(&key) {
            let val = node.borrow().value;
            self.list.remove_node(node); // 移动
            self.list.push_to_head(node.clone()); // 更新
            val
        } else {
            -1
        }
    }
    
    fn put(&mut self, key: i32, value: i32) {
        if let Some(node) = self.map.get(&key) {
            node.borrow_mut().value = value;
            self.list.remove_node(node);
            self.list.push_to_head(node.clone());
        } else {
            let new_node = Node::new(key, value);
            if self.map.len() >= self.capacity {
                if let Some(old_tail) = self.list.pop_from_tail() {
                    let old_key = old_tail.borrow().key;
                    self.map.remove(&old_key);
                }
            }
            self.list.push_to_head(new_node.clone());
            self.map.insert(key, new_node);
        }
    }
}

/**
 * Your LRUCache object will be instantiated and called as such:
 * let obj = LRUCache::new(capacity);
 * let ret_1: i32 = obj.get(key);
 * obj.put(key, value);
 */
// @lc code=end



