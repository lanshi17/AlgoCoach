/*
 * @lc app=leetcode.cn id=211 lang=rust
 * @lcpr version=30301
 *
 * [211] 添加与搜索单词 - 数据结构设计
 */

// @lc code=start
#[derive(Default)]
struct WordDictionary {
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
impl WordDictionary {

    fn new() -> Self {
        Default::default()
    }
    
    fn add_word(&mut self, word: String) {
        let mut node=&mut self.root;
        for c in word.chars(){
            let idx=(c as u8-b'a') as usize;
            let next=&mut node.children[idx];
            node=next.get_or_insert_with(Box::<Node>::default);
        }
        node.is_word=true;
    }
    
    fn search(&self, word: String) -> bool {
        Self::search_node(&word, &self.root)
    }
    
    fn search_node(word: &str, node: &Node) -> bool {
        if word.is_empty() {
            return node.is_word;
        }

        let c = word.chars().next().unwrap();
        let remaining = &word[1..]; 

        if c == '.' {
            for child_option in &node.children {
                if let Some(child_box) = child_option {
                    if Self::search_node(remaining, child_box.as_ref()) {
                        return true; 
                    }
                }
            }
            false
        } else {
            let idx = (c as u8 - b'a') as usize;
            if let Some(child_box) = &node.children[idx] {
                Self::search_node(remaining, child_box.as_ref())
            } else {
                false
            }
        }
    }
}

/**
 * Your WordDictionary object will be instantiated and called as such:
 * let obj = WordDictionary::new();
 * obj.add_word(word);
 * let ret_2: bool = obj.search(word);
 */
// @lc code=end



/*
// @lcpr case=start
// ["WordDictionary","addWord","addWord","addWord","search","search","search","search"]\n[[],["bad"],["dad"],["mad"],["pad"],["bad"],[".ad"],["b.."]]\n
// @lcpr case=end

 */

