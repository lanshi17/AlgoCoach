/*
 * @lc app=leetcode.cn id=787 lang=rust
 * @lcpr version=30304
 *
 * [787] K 站中转内最便宜的航班
 */

// @lc code=start
use std::cmp::Reverse;
use std::collections::BinaryHeap;

impl Solution {
    /// 寻找最便宜的航班价格，最多经过 k 站中转。
    ///
    /// 尝试按照注释完成整段逻辑，训练点包括：
    /// - 建图（邻接表）
    /// - 带边数限制的 Dijkstra / BFS + 堆
    pub fn find_cheapest_price(n: i32, flights: Vec<Vec<i32>>, src: i32, dst: i32, k: i32) -> i32 {
        let n = n as usize;
        let src = src as usize;
        let dst = dst as usize;
        let max_edges = (k + 1) as usize;

        // 1. ____?____
        // 提示：根据航班信息构建一个邻接表，每个城市存储它可以到达的城市及费用。
        let graph = Self::build_graph(n, flights);

        // 2. ____?____
        // 提示：调用自定义的 Dijkstra 变体，传入图、起点、终点以及最多允许的边数。
        Self::dijkstra_with_edge_limit(&graph, src, dst, max_edges)
    }

    /// 使用邻接表构建图。
    fn build_graph(n: usize, flights: Vec<Vec<i32>>) -> Vec<Vec<(usize, i32)>> {
        // 3. ____?____
        // 提示：初始化长度为 n 的二维向量，每个元素存储 (next_city, price)。
        let mut graph = vec![vec![]; n];

        for flight in flights {
            let from = flight[0] as usize;
            let to = flight[1] as usize;
            let price = flight[2];

            // 4. ____?____
            // 提示：将边 (to, price) 挂到 from 的邻居列表中。
            graph[from].push((to, price));
        }

        graph
    }

    /// 带边数限制的 Dijkstra 算法：堆中状态包含 (cost, city, edges_used)。
    fn dijkstra_with_edge_limit(
        graph: &[Vec<(usize, i32)>],
        src: usize,
        dst: usize,
        max_edges: usize,
    ) -> i32 {
        #[derive(Eq, PartialEq, Ord, PartialOrd)]
        struct State {
            cost: i32,
            city: usize,
            edges_used: usize,
        }

        let n = graph.len();

        // 5. ____?____
        // 提示：dist_to[city][edges] 表示用 edges 条边到 city 的最小花费。
        let mut dist_to = vec![vec![i32::MAX; max_edges + 1]; n];

        // 6. ____?____
        // 提示：使用最小堆（BinaryHeap + Reverse）按照费用升序弹出状态。
        let mut pq: BinaryHeap<Reverse<State>> = BinaryHeap::new();

        // 7. ____?____
        // 提示：初始化起点：0 条边、0 成本，并推入堆中。
        dist_to[src][0] = 0;
        pq.push(Reverse(State {
            cost: 0,
            city: src,
            edges_used: 0,
        }));

        while let Some(Reverse(state)) = pq.pop() {
            let State {
                cost,
                city,
                edges_used,
            } = state;

            // 8. ____?____
            // 提示：如果当前成本已经不是最优，直接跳过。
            if cost > dist_to[city][edges_used] {
                continue;
            }

            // 9. ____?____
            // 提示：堆是按费用升序的，第一个到达终点的状态就是答案。
            if city == dst {
                return cost;
            }

            // 10. ____?____
            // 提示：使用的边数达到上限，就不要继续拓展。
            if edges_used == max_edges {
                continue;
            }

            let next_edges = edges_used + 1;
            for &(next_city, price) in &graph[city] {
                // 11. ____?____
                // 提示：尝试通过当前城市松弛邻居的费用。
                let new_cost = cost + price;

                // 12. ____?____
                // 提示：如果找到更短的花费，更新 dist 并把新状态放入堆中。
                if new_cost < dist_to[next_city][next_edges] {
                    dist_to[next_city][next_edges] = new_cost;
                    pq.push(Reverse(State {
                        cost: new_cost,
                        city: next_city,
                        edges_used: next_edges,
                    }));
                }
            }
        }

        -1
    }
}

// @lc code=end

/*
// @lcpr case=start
// 4\n[[0,1,100],[1,2,100],[2,0,100],[1,3,600],[2,3,200]]\n0\n3\n1\n
// @lcpr case=end

// @lcpr case=start
// 3\n[[0,1,100],[1,2,100],[0,2,500]]\n0\n2\n1\n
// @lcpr case=end

// @lcpr case=start
// 3\n[[0,1,100],[1,2,100],[0,2,500]]\n0\n2\n0\n
// @lcpr case=end

 */
