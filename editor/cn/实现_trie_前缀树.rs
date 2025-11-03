/*
 * @lc app=leetcode.cn id=LCR 062 lang=rust
 * @lcpr version=30301
 *
 * [LCR 062] 实现 Trie (前缀树)
 */

// @lc code=start
#[derive(Default)]
struct Trie {
    root:Node,
}

#[derive(Default)]
struct Node{
    children:[Option<Box<Node>>;26],
    is_end:bool,
}


/**
 * `&self` means the method takes an immutable reference.
 * If you need a mutable reference, change it to `&mut self` instead.
 */
impl Trie {

    /** Initialize your data structure here. */
    fn new() -> Self {
        Default::default()
    }
    
    /** Inserts a word into the trie. */
    fn insert(&mut self, word: String) {
        let mut node=&mut self.root;
        for c in word.chars(){
            let idx=(c as u8-b'a')as usize;
            let mut next =&mut node.children[idx];
            node=next.get_or_insert_with(Box::<Node>::default);
        }
        node.is_end=true;
    }
    
    /** Returns if the word is in the trie. */
    fn search(&self, word: String) -> bool {
        self.get_node(&word).map_or(false,
            |w|w.is_end
        )
    }
    
    /** Returns if there is any word in the trie that starts with the given prefix. */
    fn starts_with(&self, prefix: String) -> bool {
        self.get_node(&prefix).is_some()
    }
    fn get_node(&self,w:&str)->Option<&Node>{
        let mut node=&self.root;
        for c in w.chars(){
            let idx=(c as u8-b'a')as usize;
            if let Some(next)=&node.children[idx]{
                node=next.as_ref();
            }else{
                return None;
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



