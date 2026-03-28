/*
 * @lc app=leetcode.cn id=2573 lang=rust
 * @lcpr version=30401
 *
 * [2573] 找出对应 LCP 矩阵的字符串
 */

// @lc code=start
struct DSU {
    parent: Vec<usize>,
    rank: Vec<u8>,
}

impl DSU {
    fn new(n: usize) -> Self {
        Self {
            parent: (0..n).collect(),
            rank: vec![0; n],
        }
    }

    fn find(&mut self, x: usize) -> usize {
        if self.parent[x] != x {
            let p = self.find(self.parent[x]);
            self.parent[x] = p;
        }
        self.parent[x]
    }

    fn union(&mut self, x: usize, y: usize) {
        let rx = self.find(x);
        let ry = self.find(y);
        if rx == ry {
            return;
        }
        match self.rank[rx].cmp(&self.rank[ry]) {
            std::cmp::Ordering::Less => self.parent[rx] = ry,
            std::cmp::Ordering::Greater => self.parent[ry] = rx,
            std::cmp::Ordering::Equal => {
                self.parent[ry] = rx;
                self.rank[rx] += 1;
            }
        }
    }
}

impl Solution {
    pub fn find_the_string(lcp: Vec<Vec<i32>>) -> String {
        let n = lcp.len();
        let mut dsu = DSU::new(n);

        // 1) lcp[i][j] > 0 => word[i] == word[j]
        for i in 0..n {
            for j in 0..n {
                if lcp[i][j] > 0 {
                    dsu.union(i, j);
                }
            }
        }

        // 2) 从左到右给每个连通块分配最小字符，保证字典序最小
        let mut root_to_char = vec![b'{'; n]; // '{' 比 'z' 大 1
        let mut next_ch = b'a';
        let mut ans = vec![b'a'; n];

        for i in 0..n {
            let r = dsu.find(i);
            if root_to_char[r] == b'{' {
                if next_ch > b'z' {
                    return String::new();
                }
                root_to_char[r] = next_ch;
                next_ch += 1;
            }
            ans[i] = root_to_char[r];
        }

        // 3) 倒序验证 lcp 是否完全匹配
        let mut dp = vec![vec![0i32; n + 1]; n + 1];

        for i in (0..n).rev() {
            for j in (0..n).rev() {
                dp[i][j] = if ans[i] == ans[j] {
                    1 + dp[i + 1][j + 1]
                } else {
                    0
                };
                if dp[i][j] != lcp[i][j] {
                    return String::new();
                }
            }
        }

        String::from_utf8(ans).unwrap()
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[4,0,2,0],[0,3,0,1],[2,0,2,0],[0,1,0,1]]\n
// @lcpr case=end

// @lcpr case=start
// [[4,3,2,1],[3,3,2,1],[2,2,2,1],[1,1,1,1]]\n
// @lcpr case=end

// @lcpr case=start
// [[4,3,2,1],[3,3,2,1],[2,2,2,1],[1,1,1,3]]\n
// @lcpr case=end

 */
