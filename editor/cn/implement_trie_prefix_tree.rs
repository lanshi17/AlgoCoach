/*
 * @lc app=leetcode.cn id=208 lang=rust
 * @lcpr version=30300
 *
 * [208] 实现 Trie (前缀树)
 */

// @lc code=start
#[derive(Default)]
struct Trie {
    root:Node,
}
#[derive(Default)]
struct Node{
    children:[Option<Box<Node>>;26],
    is_word:bool,
}


/** 
 * `&self` means the method takes an immutable reference.
 * If you need a mutable reference, change it to `&mut self` instead.
 */
impl Trie {

    fn new() -> Self {
        Default::default()
    }
    
    fn insert(&mut self, word: String) {
        let mut node=&mut self.root;
        for c in word.as_bytes(){
            let idx=(c-b'a') as usize;
            let next=&mut node.children[idx];
            node=next.get_or_insert_with(Box::<Node>::default);
        }
        node.is_word=true;
    }
    
    fn search(&self, word: String) -> bool {
        self.get_node(&word).map_or(
            false,
            |w|w.is_word
        )
    }
    
    fn starts_with(&self, prefix: String) -> bool {
        self.get_node(&prefix).is_some()
    }
    fn get_node(&self,s:&str)->Option<&Node>{
        let mut node=&self.root;
        for c in s.as_bytes(){
            let idx=(c-b'a') as usize;
            match &node.children[idx]{
                Some(next)=>node=next.as_ref(),
                None=>return None,
            }
        }
        Some(node)
    }
}

/**
 * Your Trie object will be instantiated and called as such:
 * let obj = Trie::new();
 * obj.insert(word);
 * let ret_2: bool = obj.search(word);
 * let ret_3: bool = obj.starts_with(prefix);
 */
// @lc code=end



