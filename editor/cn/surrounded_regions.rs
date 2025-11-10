/*
 * @lc app=leetcode.cn id=130 lang=rust
 * @lcpr version=30302
 *
 * [130] 被围绕的区域
 */

// @lc code=start
// 定义并查集 (Union-Find) 数据结构
struct UF {
    count: i32,       // 当前连通分量的数量
    parent: Vec<i32>, // parent[i] 存储节点 i 的父节点
    size: Vec<i32>,   // size[i] 存储以 i 为根的树的大小（用于平衡）
}

impl UF {
    // 构造函数：初始化一个包含 n 个节点的并查集
    fn new(n: usize) -> Self {
        let mut parent = vec![0; n];
        let size = vec![1; n];
        // 初始时，每个节点的父节点是它自己
        for i in 0..n {
            parent[i] = i as i32;
        }
        UF {
            count: n as i32,
            parent,
            size,
        }
    }

    // 查找根节点，并进行路径压缩优化
    // 路径压缩能扁平化树结构，加快 future 的查询速度
    fn find(&mut self, x: i32) -> i32 {
        let x = x as usize;
        // 如果 x 不是根节点
        if self.parent[x] != x as i32 {
            // 递归查找根节点，并将路径上的节点直接连接到根节点 (路径压缩)
            self.parent[x] = self.find(self.parent[x]);
        }
        self.parent[x]
    }

    // 合并两个节点 p 和 q 所在的集合
    fn union_set(&mut self, p: i32, q: i32) {
        let root_p = self.find(p);
        let root_q = self.find(q);

        // 如果已经在同一个集合中，则无需操作
        if root_p == root_q {
            return;
        }

        // 将较小的树合并到较大的树下，以保持树的平衡性
        if self.size[root_p as usize] > self.size[root_q as usize] {
            self.parent[root_q as usize] = root_p;
            self.size[root_p as usize] += self.size[root_q as usize];
        } else {
            self.parent[root_p as usize] = root_q;
            self.size[root_q as usize] += self.size[root_p as usize];
        }
        // 合并后，连通分量数量减一
        self.count -= 1;
    }

    // 检查两个节点 p 和 q 是否连通
    fn connected(&mut self, p: i32, q: i32) -> bool {
        self.find(p) == self.find(q)
    }

    // 返回当前连通分量的数量
    fn count_components(&self) -> i32 {
        self.count
    }
}
impl Solution {
    /// 解决“被围绕的区域”问题
    ///
    /// # 参数
    /// * `board` - 一个二维字符向量的可变引用，代表棋盘。
    ///
    /// # 功能
    /// 捕获所有被 'X' 围绕的 'O' 区域（即将其替换为 'X'）。
    ///
    pub fn solve(board: &mut Vec<Vec<char>>) {
        // 1. 处理边界情况：如果棋盘为空，直接返回
        if board.is_empty() || board[0].is_empty() {
            return;
        }

        let rows = board.len();
        let cols = board[0].len();

        // 2. 初始化并查集
        // 节点数为棋盘格子数 (rows * cols) 加上一个虚拟的 "dummy" 节点
        // "dummy" 节点用于代表所有与边界相连的 'O' 区域
        let dummy_node = (rows * cols) as i32;
        let total_nodes = rows * cols + 1;
        let mut uf = UF::new(total_nodes);

        // 3. 将边界上的 'O' 与 dummy_node 连接
        // 连接第一列和最后一列
        for i in 0..rows {
            if board[i][0] == 'O' {
                uf.union_set((i * cols) as i32, dummy_node);
            }
            if board[i][cols - 1] == 'O' {
                uf.union_set((i * cols + cols - 1) as i32, dummy_node);
            }
        }
        // 连接第一行和最后一行 (注意角落已经处理过)
        for j in 0..cols {
            if board[0][j] == 'O' {
                uf.union_set(j as i32, dummy_node);
            }
            if board[rows - 1][j] == 'O' {
                uf.union_set(((rows - 1) * cols + j) as i32, dummy_node);
            }
        }

        // 4. 定义四个方向：上、下、左、右
        const DIRECTIONS: [(i32, i32); 4] = [(-1, 0), (1, 0), (0, -1), (0, 1)];

        // 5. 遍历棋盘内部的格子 ('O' 连接相邻的 'O')
        for i in 1..(rows - 1) {
            for j in 1..(cols - 1) {
                if board[i][j] == 'O' {
                    // 检查四个方向的邻居
                    for &(dr, dc) in &DIRECTIONS {
                        let ni = i as i32 + dr;
                        let nj = j as i32 + dc;
                        // 边界检查
                        if ni >= 0 && ni < rows as i32 && nj >= 0 && nj < cols as i32 {
                            let ni = ni as usize;
                            let nj = nj as usize;
                            // 如果邻居也是 'O'，则在并查集中将它们连接
                            if board[ni][nj] == 'O' {
                                uf.union_set((i * cols + j) as i32, (ni * cols + nj) as i32);
                            }
                        }
                    }
                }
            }
        }

        // 6. 最后一步：捕获被围绕的 'O'
        // 再次遍历棋盘内部的格子
        for i in 1..(rows - 1) {
            for j in 1..(cols - 1) {
                // 如果当前格子是 'O'，并且它没有与 dummy_node 连通
                // 这意味着它被 'X' 完全围绕
                if board[i][j] == 'O' && !uf.connected((i * cols + j) as i32, dummy_node) {
                    // 将其捕获，替换为 'X'
                    board[i][j] = 'X';
                }
            }
        }
    }
}
// @lc code=end

/*
// @lcpr case=start
// [["X","X","X","X"],["X","O","O","X"],["X","X","O","X"],["X","O","X","X"]]\n
// @lcpr case=end

// @lcpr case=start
// [["X"]]\n
// @lcpr case=end

 */
