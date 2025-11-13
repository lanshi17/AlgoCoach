/*
 * @lc app=leetcode.cn id=1584 lang=rust
 * @lcpr version=30304
 *
 * [1584] 连接所有点的最小费用
 */

// @lc code=start
struct UF {
    count: usize,
    parent: Vec<usize>,
    size: Vec<usize>,
}
impl UF {
    fn new(count: usize) -> Self {
        UF {
            count: count,
            parent: (0..count).collect(),
            size: vec![0; count],
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
                std::cmp::Ordering::Greater | std::cmp::Ordering::Equal => {
                    self.parent[root_q] = root_p;
                    self.size[root_p] += self.size[root_q];
                },
                std::cmp::Ordering::Less => {
                    self.parent[root_p] = root_q;
                    self.size[root_q] += self.size[root_p];
                },
            }
        }
        self.count -= 1;
    }
    fn is_connected(&mut self, p: usize, q: usize) -> bool {
        self.find(q) == self.find(p)
    }
    fn get_count(&self) -> usize {
        self.count
    }
}
impl Solution {
    pub fn min_cost_connect_points(points: Vec<Vec<i32>>) -> i32 {
        let n = points.len();
        if n <= 1 {
            return 0;
        }
        let mut uf = UF::new(n);
        let mut edges: Vec<(usize, usize, i32)> = Vec::new();
        for i in 0..n {
            for j in i + 1..n {
                let x_i = points[i][0];
                let y_i = points[i][1];
                let x_j = points[j][0];
                let y_j = points[j][1];
                let weight = (x_i - x_j).abs() + (y_i - y_j).abs();
                edges.push((i, j, weight));
            }
        }
        edges.sort_unstable_by_key(|&(_, _, weight)| weight);
        let mut mst_cost = 0;
        let mut edges_added = 0;
        for (u, v, weight) in edges {
            if uf.is_connected(u, v) {
                continue;
            }
            mst_cost += weight;
            uf.union_set(u, v);
            edges_added += 1;
            if edges_added == n - 1 {
                break;
            }
        }
        mst_cost
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[0,0],[2,2],[3,10],[5,2],[7,0]]\n
// @lcpr case=end

// @lcpr case=start
// [[3,12],[-2,5],[-4,1]]\n
// @lcpr case=end

 */
