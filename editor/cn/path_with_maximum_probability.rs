/*
 * @lc app=leetcode.cn id=1514 lang=rust
 * @lcpr version=30304
 *
 * [1514] 概率最大的路径
 */

// @lc code=start
use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashMap};

// 包装 f64 类型以实现 Ord trait
#[derive(Debug, Clone, Copy, PartialEq)]
struct Prob(f64);

impl Eq for Prob {}

impl PartialOrd for Prob {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        self.0.partial_cmp(&other.0)
    }
}

// 实现 Ord trait，将 NaN 视为相等且最小的值
impl Ord for Prob {
    fn cmp(&self, other: &Self) -> Ordering {
        self.0.partial_cmp(&other.0).unwrap_or(Ordering::Equal)
    }
}

impl Solution {
    /// 找出从起点到终点成功概率最大的路径
    ///
    /// 在一个无向加权图中，每条边都有一个成功遍历的概率。
    /// 目标是找到从起点到终点成功概率最大的路径。
    ///
    /// # 参数说明
    /// * `n` - 图中节点的数量
    /// * `edges` - 边的列表，每条边用 [a, b] 表示连接节点 a 和 b
    /// * `succ_prob` - 每条边对应的成功概率
    /// * `start` - 起点节点
    /// * `end` - 终点节点
    ///
    /// # 返回值
    /// 从起点到终点的最大成功概率，如果无法到达则返回 0
    pub fn max_probability(
        n: i32,
        edges: Vec<Vec<i32>>,
        succ_prob: Vec<f64>,
        start: i32,
        end: i32,
    ) -> f64 {
        // 构建图的邻接表表示
        let mut graph: HashMap<usize, Vec<(usize, f64)>> = HashMap::new();

        for (i, edge) in edges.iter().enumerate() {
            let a = edge[0] as usize;
            let b = edge[1] as usize;
            let prob = succ_prob[i];

            graph.entry(a).or_insert_with(Vec::new).push((b, prob));
            graph.entry(b).or_insert_with(Vec::new).push((a, prob));
        }

        // 初始化概率数组，记录从起点到每个节点的最大概率
        // 起点的概率为 1.0，其他节点初始概率为 0.0
        let mut probabilities = vec![0.0; n as usize];
        probabilities[start as usize] = 1.0;

        // 初始化优先队列（最大堆），用于选择当前概率最大的节点
        let mut pq: BinaryHeap<(Prob, usize)> = BinaryHeap::new();

        // 将起点加入优先队列，概率为 1.0
        pq.push((Prob(1.0), start as usize));

        // Dijkstra 算法变种 - 寻找最大概率路径
        while let Some((Prob(current_prob), node)) = pq.pop() {
            // 如果当前概率小于已知的最大概率，则跳过
            if current_prob < probabilities[node] {
                continue;
            }

            // 如果该节点就是终点，返回其概率
            if node == end as usize {
                return probabilities[node];
            }

            // 遍历该节点的所有邻居
            if let Some(neighbors) = graph.get(&node) {
                for &(neighbor, edge_prob) in neighbors {
                    // 计算通过当前节点到达邻居的新概率
                    let new_prob = current_prob * edge_prob;

                    // 如果新概率大于已记录的概率，则更新并加入优先队列
                    if new_prob > probabilities[neighbor] {
                        probabilities[neighbor] = new_prob;
                        pq.push((Prob(new_prob), neighbor));
                    }
                }
            }
        }

        // 如果无法到达终点，返回 0.0
        probabilities[end as usize]
    }
}

// @lc code=end

/*
// @lcpr case=start
// 3\n[[0,1],[1,2],[0,2]]\n[0.5,0.5,0.2]\n0\n2\n
// @lcpr case=end

// @lcpr case=start
// 3\n[[0,1],[1,2],[0,2]]\n[0.5,0.5,0.3]\n0\n2\n
// @lcpr case=end

// @lcpr case=start
// 3\n[[0,1]]\n[0.5]\n0\n2\n
// @lcpr case=end

 */
