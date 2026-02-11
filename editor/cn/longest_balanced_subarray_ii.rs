/*
 * @lc app=leetcode.cn id=3721 lang=rust
 * @lcpr version=30307
 *
 * [3721] 最长平衡子数组 II
 */

// @lc code=start
use std::cmp::{max, min};
use std::collections::HashMap;

// 定义合并逻辑：我们需要同时知道区间的最小值和最大值来判断 0 是否存在
#[derive(Clone, Copy)]
struct Node {
    min_v: i32,
    max_v: i32,
}

impl Node {
    fn new(v: i32) -> Self {
        Self { min_v: v, max_v: v }
    }
}

pub struct LazySegmentTree {
    n: usize,
    tree: Vec<Node>,
    lazy: Vec<i32>,
}

impl LazySegmentTree {
    pub fn new(n: usize) -> Self {
        // 初始值设为大数，表示该位置尚未激活（不在当前处理范围内）
        let initial_node = Node {
            min_v: 1_000_000,
            max_v: 1_000_000,
        };
        Self {
            n,
            tree: vec![initial_node; 4 * n],
            lazy: vec![0; 4 * n],
        }
    }

    fn push_up(&mut self, node: usize) {
        let left = 2 * node + 1;
        let right = 2 * node + 2;
        self.tree[node].min_v = min(self.tree[left].min_v, self.tree[right].min_v);
        self.tree[node].max_v = max(self.tree[left].max_v, self.tree[right].max_v);
    }

    fn apply(&mut self, node: usize, val: i32) {
        self.tree[node].min_v += val;
        self.tree[node].max_v += val;
        self.lazy[node] += val;
    }

    fn push_down(&mut self, node: usize) {
        if self.lazy[node] != 0 {
            let val = self.lazy[node];
            self.apply(2 * node + 1, val);
            self.apply(2 * node + 2, val);
            self.lazy[node] = 0;
        }
    }

    /// 激活位置 idx，并设置初始值
    pub fn activate(&mut self, node: usize, start: usize, end: usize, idx: usize, val: i32) {
        if start == end {
            self.tree[node] = Node::new(val);
            return;
        }
        self.push_down(node);
        let mid = (start + end) / 2;
        if idx <= mid {
            self.activate(2 * node + 1, start, mid, idx, val);
        } else {
            self.activate(2 * node + 2, mid + 1, end, idx, val);
        }
        self.push_up(node);
    }

    /// 标准区间加法更新
    pub fn update_range(
        &mut self,
        node: usize,
        start: usize,
        end: usize,
        l: usize,
        r: usize,
        val: i32,
    ) {
        if start > r || end < l {
            return;
        }
        if start >= l && end <= r {
            self.apply(node, val);
            return;
        }
        self.push_down(node);
        let mid = (start + end) / 2;
        self.update_range(2 * node + 1, start, mid, l, r, val);
        self.update_range(2 * node + 2, mid + 1, end, l, r, val);
        self.push_up(node);
    }

    /// 线段树上二分：寻找区间内最左边的 0
    pub fn find_leftmost_zero(
        &mut self,
        node: usize,
        start: usize,
        end: usize,
        limit: usize,
    ) -> Option<usize> {
        // 如果当前区间最小值 > 0 或最大值 < 0，或者超出搜索边界，说明不存在 0
        if self.tree[node].min_v > 0 || self.tree[node].max_v < 0 || start > limit {
            return None;
        }
        if start == end {
            return Some(start);
        }
        self.push_down(node);
        let mid = (start + end) / 2;
        // 优先查找左子树（为了获得更长的长度）
        self.find_leftmost_zero(2 * node + 1, start, mid, limit)
            .or_else(|| self.find_leftmost_zero(2 * node + 2, mid + 1, end, limit))
    }
}

impl Solution {
    /// 计算最长平衡子数组：不同偶数个数 == 不同奇数个数
    pub fn longest_balanced(mut nums: Vec<i32>) -> i32 {
        let n = nums.len();
        if n == 0 {
            return 0;
        }

        let mut last_pos = HashMap::new();
        let mut st = LazySegmentTree::new(n);
        let mut max_len = 0;

        for (j, &val) in nums.iter().enumerate() {
            let is_odd = val % 2 != 0;
            let prev_idx = last_pos.get(&val).cloned();

            // 1. 激活当前位置 j 的左端点，初始平衡值为 0
            st.activate(0, 0, n - 1, j, 0);

            // 2. 更新区间 (prev_idx, j] 的平衡值
            // 若为偶数，平衡值 +1；若为奇数，平衡值 -1
            let l = prev_idx.map(|p| p + 1).unwrap_or(0);
            let delta = if is_odd { -1 } else { 1 };
            st.update_range(0, 0, n - 1, l, j, delta);

            // 3. 在线段树上寻找最左侧的 0
            if let Some(leftmost_i) = st.find_leftmost_zero(0, 0, n - 1, j) {
                max_len = max(max_len, (j - leftmost_i + 1) as i32);
            }

            // 4. 更新元素的最后出现位置
            last_pos.insert(val, j);
        }

        max_len
    }
}
// @lc code=end

/*
// @lcpr case=start
// [2,5,4,3]\n
// @lcpr case=end

// @lcpr case=start
// [3,2,2,5,4]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3,2]\n
// @lcpr case=end

 */
