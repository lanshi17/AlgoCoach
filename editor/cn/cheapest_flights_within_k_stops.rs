/*
 * @lc app=leetcode.cn id=787 lang=rust
 * @lcpr version=30304
 *
 * [787] K 站中转内最便宜的航班
 */

// @lc code=start
impl Solution {
    pub fn find_cheapest_price(n: i32, flights: Vec<Vec<i32>>, src: i32, dst: i32, k: i32) -> i32 {
        let (n, src, dst) = (n as usize, src as usize, dst as usize);
        let mut pre = vec![i32::MAX; n];
        pre[src] = 0;

        // 最多k站中转意味着最多k+1条边的路径
        for _ in 0..=k {
            let mut cur = pre.clone();
            for edge in &flights {
                let (u, v, w) = (edge[0] as usize, edge[1] as usize, edge[2]);
                // 如果从起点到u是可达的，则更新到v的最短距离
                if pre[u] != i32::MAX {
                    cur[v] = cur[v].min(pre[u] + w);
                }
            }
            pre = cur;
        }

        if pre[dst] != i32::MAX {
            pre[dst]
        } else {
            -1
        }
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
