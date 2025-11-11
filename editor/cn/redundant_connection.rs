/*
 * @lc app=leetcode.cn id=684 lang=rust
 * @lcpr version=30304
 *
 * [684] 冗余连接
 */

// @lc code=start
struct UF {
    count: i32,
    parent: Vec<i32>,
    size: Vec<i32>,
}
impl UF {
    fn new(n: usize) -> Self {
        let mut parent = vec![0; n];
        let mut size = vec![1; n as usize];
        for i in 0..n as usize {
            parent[i] = i as i32;
        }
        UF {
            count: n as i32,
            parent,
            size,
        }
    }
    fn find(&mut self, x: i32) -> i32 {
        let x = x as usize;
        if self.parent[x] != x as i32 {
            self.parent[x] = self.find(self.parent[x]);
        }
        self.parent[x]
    }
    fn union_set(&mut self, p: i32, q: i32) {
        let root_p = self.find(p) as usize;
        let root_q = self.find(q) as usize;
        if root_q == root_p {
            return;
        }
        if self.size[root_q] > self.size[root_p] {
            self.parent[root_p] = root_q as i32;
            self.size[root_q] += self.size[root_p];
        } else {
            self.parent[root_q] = root_p as i32;
            self.size[root_p] += self.size[root_q];
        }
        self.count -= 1;
    }
    fn is_connected(&mut self, p: i32, q: i32) -> bool {
        self.find(p) == self.find(q)
    }
    fn count_components(&self) -> i32 {
        self.count
    }
}
impl Solution {
    pub fn find_redundant_connection(edges: Vec<Vec<i32>>) -> Vec<i32> {
        if edges.len() <= 0 {
            return vec![];
        }
        let mut uf = UF::new(edges.len() + 1);
        for edge in edges {
            let a = edge[0];
            let b = edge[1];
            if uf.is_connected(a, b) {
                return vec![a, b];
            }
            uf.union_set(a, b);
        }
        vec![]
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[1,2],[1,3],[2,3]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,2],[2,3],[3,4],[1,4],[1,5]]\n
// @lcpr case=end

 */
