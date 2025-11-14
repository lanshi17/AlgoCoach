/*
 * @lc app=leetcode.cn id=1631 lang=rust
 * @lcpr version=30304
 *
 * [1631] 最小体力消耗路径
 */

// @lc code=start
use std::cmp::Reverse;
use std::collections::BinaryHeap;

impl Solution {
    pub fn minimum_effort_path(heights: Vec<Vec<i32>>) -> i32 {
        if heights.is_empty() || heights[0].is_empty() {
            return 0;
        }
        
        let rows = heights.len();
        let cols = heights[0].len();
        let total_nodes = rows * cols;
        
        // 使用优先队列实现Dijkstra算法
        let mut heap = BinaryHeap::new();
        let mut efforts = vec![i32::MAX; total_nodes];
        
        efforts[0] = 0;
        heap.push(Reverse((0, 0))); // (effort, node_index)
        
        let directions = [(0, 1), (1, 0), (0, -1), (-1, 0)];
        
        while let Some(Reverse((current_effort, current_node))) = heap.pop() {
            let r = current_node / cols;
            let c = current_node % cols;
            
            // 如果到达终点
            if r == rows - 1 && c == cols - 1 {
                return current_effort;
            }
            
            // 如果当前effort大于已知的到该节点的effort，则跳过
            if current_effort > efforts[current_node] {
                continue;
            }
            
            // 探索四个方向
            for &(dr, dc) in &directions {
                let nr = r as i32 + dr;
                let nc = c as i32 + dc;
                
                // 检查边界
                if nr >= 0 && nr < rows as i32 && nc >= 0 && nc < cols as i32 {
                    let nr = nr as usize;
                    let nc = nc as usize;
                    let next_node = nr * cols + nc;
                    
                    // 计算到下一个节点的努力值
                    let effort_to_next = (heights[r][c] - heights[nr][nc]).abs();
                    let max_effort = current_effort.max(effort_to_next);
                    
                    // 如果找到了更小的努力值路径
                    if max_effort < efforts[next_node] {
                        efforts[next_node] = max_effort;
                        heap.push(Reverse((max_effort, next_node)));
                    }
                }
            }
        }
        
        efforts[total_nodes - 1]
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[1,2,2],[3,8,2],[5,3,5]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,2,3],[3,8,4],[5,3,5]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,2,1,1,1],[1,2,1,2,1],[1,2,1,2,1],[1,2,1,2,1],[1,1,1,2,1]]\n
// @lcpr case=end

 */
