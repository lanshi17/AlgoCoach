/*
 * @lc app=leetcode.cn id=990 lang=rust
 * @lcpr version=30302
 *
 * [990] 等式方程的可满足性
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
        let size = vec![0; n];
        for i in 0..n {
            parent[i] = i as i32;
        }
        UF {
            count: n as i32,
            parent,
            size,
        }
    }
    fn union_set(&mut self, p: i32, q: i32) {
        let root_p = self.find(p);
        let root_q = self.find(q);
        if root_q == root_p {
            return;
        }
        if self.size[root_p as usize] > self.size[root_q as usize] {
            self.parent[root_q as usize] = root_p;
            self.size[root_p as usize] += self.size[root_q as usize];
        } else {
            self.parent[root_p as usize] = root_q;
            self.size[root_q as usize] += self.size[root_p as usize];
        }
        self.count -= 1;
    }
    fn find(&mut self, x: i32) -> i32 {
        let x = x as usize;
        if self.parent[x] != x as i32 {
            self.parent[x] = self.find(self.parent[x]);
        }
        self.parent[x]
    }
    fn connected(&mut self, p: i32, q: i32) -> bool {
        self.find(p) == self.find(q)
    }
    fn count_components(&self) -> i32 {
        self.count
    }
}
impl Solution {
    pub fn equations_possible(equations: Vec<String>) -> bool {
        let mut uf = UF::new(26);
        for equation in &equations {
            let equation = equation.as_bytes();
            if equation[1] == b'=' {
                let x = equation[0];
                let y = equation[3];
                uf.union_set((x as u8 - b'a') as i32, (y as u8 - b'a') as i32);
            }
        }
        for equation in &equations {
            let equation = equation.as_bytes();
            if equation[1] == b'!' {
                let x = equation[0];
                let y = equation[3];
                if uf.connected((x as u8 - b'a') as i32, (y as u8 - b'a') as i32) {
                    return false;
                }
            }
        }
        true
    }
}
// @lc code=end

/*
// @lcpr case=start
// ["a==b","b!=a"]\n
// @lcpr case=end

// @lcpr case=start
// ["b==a","a==b"]\n
// @lcpr case=end

 */
