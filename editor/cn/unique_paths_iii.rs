/*
 * @lc app=leetcode.cn id=980 lang=rust
 * @lcpr version=30304
 *
 * [980] 不同路径 III
 */

// @lc code=start
impl Solution {
    /// 计算网格中从起点到终点的所有不同路径数量，要求每条路径必须走完所有无障碍格子一次
    ///
    /// # 参数
    /// * `grid` - 二维网格，其中:
    ///   - 1 表示起点
    ///   - 2 表示终点
    ///   - 0 表示可通行的空格子
    ///   - -1 表示障碍物
    ///
    /// # 返回值
    /// 返回满足条件的路径总数（每条路径必须恰好经过所有空格子和起点一次）
    pub fn unique_paths_iii(grid: Vec<Vec<i32>>) -> i32 {
        let mut unique = UniquePathsSolver::new();
        unique.unique_paths_iii(grid)
    }
}

/// 路径求解器结构体，封装了解决方案所需的所有状态变量
struct UniquePathsSolver {
    /// 存储符合条件的路径总数
    res: i32,
    /// 标记每个格子是否已被访问的二维布尔数组
    visited: Vec<Vec<bool>>,
    /// 当前已访问的格子数量
    visited_count: i32,
    /// 网格中需要访问的总格子数（包括起点和空格子）
    total_count: i32,
}

impl UniquePathsSolver {
    /// 创建一个新的路径求解器实例
    fn new() -> Self {
        Self {
            res: 0,
            visited: vec![],
            visited_count: 0,
            total_count: 0,
        }
    }

    /// 主函数：计算唯一路径 III
    ///
    /// # 算法步骤
    /// 1. 初始化访问标记数组
    /// 2. 统计需要访问的总格子数并找到起点位置
    /// 3. 使用深度优先搜索(DFS)寻找所有有效路径
    pub fn unique_paths_iii(&mut self, grid: Vec<Vec<i32>>) -> i32 {
        let m = grid.len();
        let n = grid[0].len();
        self.visited = vec![vec![false; n]; m];
        let mut start_i = 0;
        let mut start_j = 0;
        for i in 0..m {
            for j in 0..n {
                if grid[i][j] == 1 {
                    start_i = i;
                    start_j = j;
                }
                if grid[i][j] == 1 || grid[i][j] == 0 {
                    self.total_count += 1;
                }
            }
        }
        self.dfs(&grid, start_i, start_j);
        self.res
    }

    /// 深度优先搜索函数，用于寻找所有有效路径
    ///
    /// # 参数
    /// * `grid` - 原始网格的不可变引用
    /// * `i` - 当前行坐标
    /// * `j` - 当前列坐标
    ///
    /// # 算法逻辑
    /// 1. 边界检查和剪枝条件判断
    /// 2. 到达终点时检查是否访问了所有必需格子
    /// 3. 标记当前位置为已访问
    /// 4. 向四个方向递归探索
    /// 5. 回溯：撤销当前位置的访问标记
    fn dfs(&mut self, grid: &Vec<Vec<i32>>, i: usize, j: usize) {
        let m = grid.len();
        let n = grid[0].len();
        if i >= m || j >= n {
            return;
        }
        if grid[i][j] == -1 || self.visited[i][j] {
            return;
        }
        if grid[i][j] == 2 {
            if self.visited_count == self.total_count {
                self.res += 1;
            }
            return;
        }
        self.visited[i][j] = true;
        self.visited_count += 1;
        let dirs = [(0, 1), (0, -1), (1, 0), (-1, 0)];
        for (d_i, d_j) in dirs {
            let next_i = i as i32 + d_i;
            let next_j = j as i32 + d_j;
            if next_i >= 0 && next_i < m as i32 && next_j >= 0 && next_j < n as i32 {
                self.dfs(grid, next_i as usize, next_j as usize);
            }
        }
        self.visited[i][j] = false;
        self.visited_count -= 1;
    }
}

// @lc code=end

/*
// @lcpr case=start
// [[1,0,0,0],[0,0,0,0],[0,0,2,-1]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,0,0,0],[0,0,0,0],[0,0,0,2]]\n
// @lcpr case=end

// @lcpr case=start
// [[0,1],[2,0]]\n
// @lcpr case=end

 */
