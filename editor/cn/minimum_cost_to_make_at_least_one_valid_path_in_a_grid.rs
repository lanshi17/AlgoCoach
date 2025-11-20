/*
 * @lc app=leetcode.cn id=1368 lang=rust
 * @lcpr version=30304
 *
 * [1368] 使网格图至少有一条有效路径的最小代价
 */

// @lc code=start
use std::cmp::Reverse;
use std::collections::BinaryHeap;
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct State {
    x: usize,
    y: usize,
    cost_from_start: i32,
}

impl State {
    //       使用字段初始化语法 { x, y, cost_from_start }
    fn new(x: usize, y: usize, cost_from_start: i32) -> Self {
        Self {
            x,
            y,
            cost_from_start,
        }
    }
}

impl Ord for State {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        // 正常比较：cost 小的 < cost 大的
        self.cost_from_start.cmp(&other.cost_from_start)
    }
}

impl PartialOrd for State {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Solution {
    // 根据方向编号得到 (delta_x, delta_y)
    fn get_delta(direction_id: i32) -> (i32, i32) {
        //       1 => (0, 1)   // 右
        //       2 => (0, -1)  // 左
        //       3 => (1, 0)   // 下
        //       4 => (-1, 0)  // 上
        //       _ => (0, 0)
        match direction_id {
            1 => (0, 1),
            2 => (0, -1),
            3 => (1, 0),
            4 => (-1, 0),
            _ => (0, 0),
        }
    }

    // 用 Dijkstra 算法在 grid 上求从 (0,0) 到 (m-1,n-1) 的最小代价
    fn dijkstra(grid: &Vec<Vec<i32>>) -> i32 {
        let m = grid.len();
        let n = grid[0].len();
        // dist_to[x][y] 表示起点到 (x,y) 的最短代价
        // -1 表示还没确定最短路（相当于“未访问”）
        let mut dist_to = vec![vec![-1; n]; m];
        // 优先队列：存放 Reverse<State>，实现“最小堆”
        let mut pq: BinaryHeap<Reverse<State>> = BinaryHeap::new();
        pq.push(Reverse(State::new(0, 0, 0)));
        // 主循环：每次取出当前堆顶（代价最小的状态）
        while let Some(Reverse(state)) = pq.pop() {
            let cur_x = state.x;
            let cur_y = state.y;
            let cur_cost_from_start = state.cost_from_start;
            // 如果这个点已经有 dist 值了，说明之前已经用更小的代价“确定”过，跳过
            if dist_to[cur_x][cur_y] != -1 {
                continue;
            }
            // 否则，第一次到达这个点，把当前总代价记入 dist_to
            dist_to[cur_x][cur_y] = cur_cost_from_start;

            // 如果已经到达终点 (m-1, n-1)，可以直接返回当前总代价
            if cur_x == m - 1 && cur_y == n - 1 {
                return cur_cost_from_start;
            }
            // 否则，从当前点往四个方向扩展
            for direction_id in 1..=4 {
                let (delta_x, delta_y) = Self::get_delta(direction_id);
                let next_x = cur_x as i32 + delta_x;
                let next_y = cur_y as i32 + delta_y;
                // 越界就跳过
                if next_x < 0 || next_x >= m as i32 || next_y < 0 || next_y >= n as i32 {
                    continue;
                }
                // 在边界内，把 next_x, next_y 转回 usize
                // TODO: 把 next_x, next_y 转成 usize
                let next_x = next_x as usize;
                let next_y = next_y as usize;
                let mut next_cost_from_start = cur_cost_from_start;
                // 计算从起点到下一个点的代价
                // 初始等于 cur_cost_from_start
                // 如果当前格子的箭头方向 != 我们走的方向 direction_id，则额外+1
                if grid[cur_x][cur_y] != direction_id {
                    next_cost_from_start += 1;
                }
                // 只有当这个点还没被“确定最短路”时，才考虑把它入堆
                if dist_to[next_x][next_y] == -1 {
                    pq.push(Reverse(State::new(next_x, next_y, next_cost_from_start)));
                }
            }
        }

        // 理论上不会走到这里（题目保证有路），但按原代码返回 -1
        -1
    }

    pub fn min_cost(grid: Vec<Vec<i32>>) -> i32 {
        Self::dijkstra(&grid)
    }
}

// @lc code=end

/*
// @lcpr case=start
// [[1,1,1,1],[2,2,2,2],[1,1,1,1],[2,2,2,2]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,1,3],[3,2,2],[1,1,4]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,2],[4,3]]\n
// @lcpr case=end

 */
