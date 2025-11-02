/*
 * @lc app=leetcode.cn id=648 lang=rust
 * @lcpr version=30300
 *
 * [648] 单词替换
 */

// @lc code=start
#[derive(Default)]
pub struct Trie {
    root: Node,
}
#[derive(Default)]
struct Node {
    children: [Option<Box<Node>>; 26],
    is_word: bool,
}
impl Trie {
    fn new() -> Self {
        Default::default()
    }
    fn insert(&mut self, word: &String) {
        let mut node = &mut self.root;
        for c in word.as_bytes() {
            let idx = (c - b'a') as usize;
            let next = &mut node.children[idx];
            node = next.get_or_insert_with(Box::<Node>::default);
        }
        node.is_word = true;
    }
    fn search(&self, word: String) -> bool {
        self.get_node(&word).map_or(false, |w| w.is_word)
    }
    fn starts_with(&self, prefix: String) -> bool {
        self.get_node(&prefix).is_some()
    }
    fn get_node(&self, s: &str) -> Option<&Node> {
        let mut node = &self.root;
        for c in s.as_bytes() {
            let idx = (c - b'a') as usize;
            match &node.children[idx] {
                Some(next) => node = next.as_ref(),
                None => return None,
            }
        }
        Some(node)
    }
    fn find_shortest_root(&self, word: &str) -> Option<String> {
        let mut node = &self.root;
        let mut prefix = String::new();

        for c in word.chars() {
            let idx = (c as u8 - b'a') as usize;
            prefix.push(c);
            match &node.children[idx] {
                Some(next) => {
                    node = next.as_ref();
                    if node.is_word {
                        return Some(prefix);
                    }
                },
                None => return None,
            }
        }
        None
    }
}
impl Solution {
    pub fn replace_words(dictionary: Vec<String>, sentence: String) -> String {
        let mut trie = Trie::new();
        for dict in dictionary.iter() {
            trie.insert(dict);
        }
        let mut res = Vec::new();
        for word in sentence.split(" ") {
            match trie.find_shortest_root(word) {
                // 如果找到词根，则使用词根替换原单词
                Some(root) => res.push(root),
                // 如果未找到词根，则保留原单词
                None => res.push(word.to_string()),
            }
        }
        res.join(" ")
    }
}
// @lc code=end

/*
// @lcpr case=start
// ["cat","bat","rat"]\n"the cattle was rattled by the battery"\n
// @lcpr case=end

// @lcpr case=start
// ["a","b","c"]\n"aadsfasf absbs bbab cadsfafs"\n
// @lcpr case=end

 */
