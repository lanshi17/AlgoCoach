/*
 * @lc app=leetcode.cn id=3567 lang=rust
 * @lcpr version=30400
 *
 * [3567] 子矩阵的最小绝对差
 */

// @lc code=start
use std::collections::BTreeMap;
use std::ops::Bound::{Excluded, Unbounded};

struct MinDiffSet {
    cnt: BTreeMap<i64, usize>,
    diffs: BTreeMap<i64, usize>,
}

impl MinDiffSet {
    fn new() -> Self {
        Self {
            cnt: BTreeMap::new(),
            diffs: BTreeMap::new(),
        }
    }

    fn inc(map: &mut BTreeMap<i64, usize>, key: i64) {
        *map.entry(key).or_insert(0) += 1;
    }

    fn dec(map: &mut BTreeMap<i64, usize>, key: i64) {
        if let Some(v) = map.get_mut(&key) {
            if *v == 1 {
                map.remove(&key);
            } else {
                *v -= 1;
            }
        }
    }

    fn add(&mut self, x: i64) {
        if let Some(c) = self.cnt.get_mut(&x) {
            *c += 1;
            return;
        }

        let pred = self.cnt.range(..x).next_back().map(|(k, _)| *k);
        let succ = self
            .cnt
            .range((Excluded(x), Unbounded))
            .next()
            .map(|(k, _)| *k);

        if let (Some(p), Some(s)) = (pred, succ) {
            Self::dec(&mut self.diffs, s - p);
        }
        if let Some(p) = pred {
            Self::inc(&mut self.diffs, x - p);
        }
        if let Some(s) = succ {
            Self::inc(&mut self.diffs, s - x);
        }

        self.cnt.insert(x, 1);
    }

    fn remove(&mut self, x: i64) {
        if let Some(c) = self.cnt.get_mut(&x) {
            if *c > 1 {
                *c -= 1;
                return;
            }
        } else {
            return;
        }

        let pred = self.cnt.range(..x).next_back().map(|(k, _)| *k);
        let succ = self
            .cnt
            .range((Excluded(x), Unbounded))
            .next()
            .map(|(k, _)| *k);

        if let Some(p) = pred {
            Self::dec(&mut self.diffs, x - p);
        }
        if let Some(s) = succ {
            Self::dec(&mut self.diffs, s - x);
        }
        if let (Some(p), Some(s)) = (pred, succ) {
            Self::inc(&mut self.diffs, s - p);
        }

        self.cnt.remove(&x);
    }

    fn min_diff(&self) -> i64 {
        if self.cnt.len() <= 1 {
            0
        } else {
            *self.diffs.keys().next().unwrap()
        }
    }
}
impl Solution {
    pub fn min_abs_diff(grid: Vec<Vec<i32>>, k: i32) -> Vec<Vec<i32>> {
        let m = grid.len();
        if m == 0 {
            return vec![];
        }
        let n = grid[0].len();
        let k = k as usize;
        if k == 0 || k > m || k > n {
            return vec![];
        }

        let rows = m - k + 1;
        let cols = n - k + 1;
        let mut ans = vec![vec![0i32; cols]; rows];

        let mut ds = MinDiffSet::new();

        // 初始窗口 (0,0)
        for i in 0..k {
            for j in 0..k {
                ds.add(grid[i][j] as i64);
            }
        }

        let mut cur_col = 0usize;

        for i in 0..rows {
            if i % 2 == 0 {
                // 左 -> 右
                for j in 0..cols {
                    ans[i][j] = ds.min_diff() as i32;
                    if j + 1 < cols {
                        let out_col = j;
                        let in_col = j + k;
                        for r in i..i + k {
                            ds.remove(grid[r][out_col] as i64);
                            ds.add(grid[r][in_col] as i64);
                        }
                    }
                }
                cur_col = cols - 1;
            } else {
                // 右 -> 左
                for j in (0..cols).rev() {
                    ans[i][j] = ds.min_diff() as i32;
                    if j > 0 {
                        let out_col = j + k - 1;
                        let in_col = j - 1;
                        for r in i..i + k {
                            ds.remove(grid[r][out_col] as i64);
                            ds.add(grid[r][in_col] as i64);
                        }
                    }
                }
                cur_col = 0;
            }

            // 下移一行
            if i + 1 < rows {
                let top = i;
                let bottom = i + k;
                for c in cur_col..cur_col + k {
                    ds.remove(grid[top][c] as i64);
                    ds.add(grid[bottom][c] as i64);
                }
            }
        }

        ans
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[1,8],[3,-2]]\n2\n
// @lcpr case=end

// @lcpr case=start
// [[3,-1]]\n1\n
// @lcpr case=end

// @lcpr case=start
// [[1,-2,3],[2,3,5]]\n2\n
// @lcpr case=end

 */
