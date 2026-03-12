/*
 * @lc app=leetcode.cn id=3600 lang=rust
 * @lcpr version=30400
 *
 * [3600] 升级后最大生成树稳定性
 */

// @lc code=start
#[derive(Clone)]
struct DSU {
    parent: Vec<usize>,
    size: Vec<usize>,
    comps: usize,
}
impl DSU {
    fn new(n: usize) -> Self {
        Self {
            parent: (0..n).collect(),
            size: vec![1; n],
            comps: n,
        }
    }

    // iterative find with path halving
    fn find(&mut self, mut x: usize) -> usize {
        while self.parent[x] != x {
            self.parent[x] = self.parent[self.parent[x]];
            x = self.parent[x];
        }
        x
    }

    fn union(&mut self, a: usize, b: usize) -> bool {
        let mut ra = self.find(a);
        let mut rb = self.find(b);
        if ra == rb {
            return false;
        }
        if self.size[ra] < self.size[rb] {
            std::mem::swap(&mut ra, &mut rb);
        }
        self.parent[rb] = ra;
        self.size[ra] += self.size[rb];
        self.comps -= 1;
        true
    }
}
#[derive(Clone, Copy)]
struct Edge {
    u: usize,
    v: usize,
    w: i32,
}
impl Solution {
    pub fn max_stability(n: i32, edges: Vec<Vec<i32>>, k: i32) -> i32 {
        let n = n as usize;
        if n <= 1 {
            return 0;
        }
        // 1) 必选边：判环 + min_must + max_s
        let mut dsu_must = DSU::new(n);
        let mut has_must = false;
        let mut min_must: i32 = i32::MAX;
        let mut max_s: i32 = 0;

        for e in &edges {
            let u = e[0] as usize;
            let v = e[1] as usize;
            let w = e[2];
            let must = e[3] == 1;
            max_s = max_s.max(w);

            if must {
                has_must = true;
                if !dsu_must.union(u, v) {
                    return -1; // 必选边成环
                }
                min_must = min_must.min(w);
            }
        }
        // 2) 收缩必选边连通块：root -> component id
        let mut root_to_id = vec![usize::MAX; n];
        let mut comp_id = vec![0usize; n];
        let mut cc = 0usize;

        for i in 0..n {
            let r = dsu_must.find(i);
            if root_to_id[r] == usize::MAX {
                root_to_id[r] = cc;
                cc += 1;
            }
            comp_id[i] = root_to_id[r];
        }

        // 如果必选边已经把图连通，则答案就是 min_must
        if has_must && cc == 1 {
            return min_must;
        }
        // 3) 构建“组件图”上的可选边列表
        let mut opt: Vec<Edge> = Vec::new();
        opt.reserve(edges.len());

        for e in &edges {
            if e[3] == 1 {
                continue;
            }
            let u0 = e[0] as usize;
            let v0 = e[1] as usize;
            let w = e[2];
            let u = comp_id[u0];
            let v = comp_id[v0];
            if u == v {
                continue;
            }
            opt.push(Edge { u, v, w });
        }
        // 4) 二分 target 的整数范围
        let mut left: i32 = 1;
        let mut right: i32 = if has_must {
            min_must
        } else {
            // si <= 1e5，所以这里 <= 2e5
            max_s.saturating_mul(2)
        };

        if right < 1 {
            return -1;
        }

        let k = k as i32;

        // check(target): 能否用 <=k 次升级把 cc 个组件连成 1 个
        let mut feasible = |target: i32| -> bool {
            if has_must && target > min_must {
                return false;
            }
            let mut dsu = DSU::new(cc);

            // 先用无需升级的边（w >= target）
            for &e in &opt {
                if e.w >= target {
                    dsu.union(e.u, e.v);
                    if dsu.comps == 1 {
                        return true;
                    }
                }
            }

            // 再用升级后可达标的边（w < target && 2w >= target），每条成功 union 才消耗 1 次升级
            let mut used = 0i32;
            for &e in &opt {
                if e.w < target && (e.w as i64) * 2 >= target as i64 {
                    if dsu.union(e.u, e.v) {
                        used += 1;
                        if used > k {
                            return false;
                        }
                        if dsu.comps == 1 {
                            return true;
                        }
                    }
                }
            }

            dsu.comps == 1 && used <= k
        };
        // 若 target=1 都不可行，则无法构成生成树
        if !feasible(1) {
            return -1;
        }

        let mut ans = 1;
        while left <= right {
            let mid = left + (right - left) / 2;
            if feasible(mid) {
                ans = mid;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        ans
    }
}
// @lc code=end

/*
// @lcpr case=start
// 3\n[[0,1,2,1],[1,2,3,0]]\n1\n
// @lcpr case=end

// @lcpr case=start
// 3\n[[0,1,4,0],[1,2,3,0],[0,2,1,0]]\n2\n
// @lcpr case=end

// @lcpr case=start
// 3\n[[0,1,1,1],[1,2,1,1],[2,0,1,1]]\n0\n
// @lcpr case=end

 */
