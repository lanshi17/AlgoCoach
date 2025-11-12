/*
 * @lc app=leetcode.cn id=947 lang=rust
 * @lcpr version=30304
 *
 * [947] 移除最多的同行或同列石头
 */

// @lc code=start
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
struct UF {
    count: usize,
    parent: Vec<usize>,
    size: Vec<usize>,
}
impl UF {
    fn new(n: usize) -> Self {
        UF {
            count: n,
            parent: (0..n).collect(),
            size: vec![1; n],
        }
    }
    fn find(&mut self, x: usize) -> usize {
        if self.parent[x] != x {
            self.parent[x] = self.find(self.parent[x]);
        }
        self.parent[x]
    }
    fn union_set(&mut self, p: usize, q: usize) {
        let root_p = self.find(p);
        let root_q = self.find(q);
        if root_p != root_q {
            match self.size[root_p].cmp(&self.size[root_q]) {
                Ordering::Less | Ordering::Equal => {
                    self.parent[root_p] = root_q;
                    self.size[root_q] += self.size[root_p];
                },
                Ordering::Greater => {
                    self.parent[root_q] = root_p;
                    self.size[root_p] += self.size[root_q];
                },
            }
            self.count -= 1;
        }
    }
    fn is_connected(&mut self, p: usize, q: usize) -> bool {
        self.find(p) == self.find(q)
    }
    fn compose_count(&self) -> usize {
        self.count
    }
}
impl Solution {
    pub fn remove_stones(stones: Vec<Vec<i32>>) -> i32 {
        let n = stones.len();

        // 创建两个 HashMap，用于存储每一行和每一列的所有石头的索引。
        // 键是行/列索引，值是该行/列上所有石头的索引列表。
        let mut row_to_indices: HashMap<i32, Vec<usize>> = HashMap::new();
        let mut col_to_indices: HashMap<i32, Vec<usize>> = HashMap::new();

        // 遍历所有石头，建立行/列到石头索引的映射。
        // enumerate() 提供了石头的索引 (id)，&stone 是对石头坐标的引用。
        for (id, stone) in stones.iter().enumerate() {
            let x = stone[0]; // 获取行坐标
            let y = stone[1]; // 获取列坐标

            // 将当前石头的索引 id 添加到其所在行 x 的列表中。
            // entry() API 提供了高效且安全的访问方式：
            // - 如果键 x 不存在，则 or_insert_with(Vec::new) 会创建一个新的空 Vec 并插入。
            // - and_modify(|v| v.push(id)) 则在键存在时，获取其可变引用并添加 id。
            // or_default() 是 or_insert_with(Vec::new) 的简写。
            row_to_indices.entry(x).or_default().push(id);

            // 同理，将索引 id 添加到其所在列 y 的列表中。
            col_to_indices.entry(y).or_default().push(id);
        }

        // 初始化并查集，每个石头初始时都是一个独立的集合。
        let mut uf = UF::new(n);

        // 处理所有在同一行的石头：将它们合并到同一个集合中。
        // values() 返回 HashMap 中所有值（Vec<usize>）的迭代器。
        for indices in row_to_indices.values() {
            // 如果该行至少有两块石头
            if indices.len() > 1 {
                // 取第一块石头的索引作为"代表"
                let first_id = indices[0];
                // 遍历该行的其余石头
                for &other_id in &indices[1..] {
                    // 将它们与"代表"石头合并
                    uf.union_set(first_id, other_id);
                }
            }
        }

        // 处理所有在同一列的石头：将它们合并到同一个集合中。
        // 逻辑与处理行相同。
        for indices in col_to_indices.values() {
            if indices.len() > 1 {
                let first_id = indices[0];
                for &other_id in &indices[1..] {
                    uf.union_set(first_id, other_id);
                }
            }
        }

        // 最终，并查集中独立集合的数量就是无法被移除的石头（每个连通分量的根）的数量。
        // 因此，可以移除的石头数量 = 总数 - 无法移除的数量。
        (n - uf.compose_count()) as i32
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[0,0],[0,1],[1,0],[1,2],[2,1],[2,2]]\n
// @lcpr case=end

// @lcpr case=start
// [[0,0],[0,2],[1,1],[2,0],[2,2]]\n
// @lcpr case=end

// @lcpr case=start
// [[0,0]]\n
// @lcpr case=end

 */
