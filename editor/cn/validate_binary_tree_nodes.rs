/*
 * @lc app=leetcode.cn id=1361 lang=rust
 * @lcpr version=30304
 *
 * [1361] 验证二叉树
 */

// @lc code=start
use std::cmp::Ordering;
use std::collections::HashSet;
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
        let root_p = self.find(p as usize);
        let root_q = self.find(q as usize);
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
    pub fn validate_binary_tree_nodes(n: i32, left_child: Vec<i32>, right_child: Vec<i32>) -> bool {
        let n = n as usize;
        let mut indegree = vec![0; n];
        for i in 0..n {
            if left_child[i] != -1 {
                indegree[left_child[i] as usize] += 1;
            }
            if right_child[i] != -1 {
                indegree[right_child[i] as usize] += 1;
            }
        }
        let mut root: Option<usize> = None;
        for i in 0..n {
            if indegree[i] == 0 {
                if root.is_some() {
                    return false;
                }
                root = Some(i);
            } else if indegree[i] != 1 {
                return false;
            }
        }
        if root.is_none() {
            return false;
        }
        let mut uf = UF::new(n);
        for i in 0..n {
            let left = left_child[i];
            let right = right_child[i];
            if left != -1 {
                let left = left as usize;
                if uf.is_connected(i, left) {
                    return false;
                }
                uf.union_set(i, left);
            }
            if right != -1 {
                let right = right as usize;
                if uf.is_connected(i, right) {
                    return false;
                }
                uf.union_set(i, right);
            }
        }
        uf.compose_count() == 1
    }
}
// @lc code=end

/*
// @lcpr case=start
// 4\n[1,-1,3,-1]\n[2,-1,-1,-1]\n
// @lcpr case=end

// @lcpr case=start
// 4\n[1,-1,3,-1]\n[2,3,-1,-1]\n
// @lcpr case=end

// @lcpr case=start
// 2\n[1,0]\n[-1,-1]\n
// @lcpr case=end

 */
