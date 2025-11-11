/*
 * @lc app=leetcode.cn id=547 lang=rust
 * @lcpr version=30304
 *
 * [547] 省份数量
 */

// @lc code=start
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
            size: vec![0; n],
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
                std::cmp::Ordering::Less => self.parent[root_p] = root_q,
                std::cmp::Ordering::Greater => self.parent[root_q] = root_p,
                std::cmp::Ordering::Equal => {
                    self.parent[root_q] = root_p;
                    self.size[root_p] += 1;
                },
            }
        }
        self.count -= 1;
    }
    fn is_connected(&mut self, p: usize, q: usize) -> bool {
        self.find(p) == self.find(q)
    }
    fn compose_count(&self) -> usize {
        self.count
    }
}
impl Solution {
    pub fn find_circle_num(is_connected: Vec<Vec<i32>>) -> i32 {
        let mut uf = UF::new(is_connected.len());
        for i in 0..is_connected.len() {
            for j in (i + 1)..is_connected.len() {
                if is_connected[i][j] == 1 {
                    uf.union_set(i, j);
                }
            }
        }
        (0..is_connected.len())
            .map(|x| uf.find(x))
            .collect::<std::collections::HashSet<_>>()
            .len() as i32
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[1,1,0],[1,1,0],[0,0,1]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,0,0],[0,1,0],[0,0,1]]\n
// @lcpr case=end

 */
