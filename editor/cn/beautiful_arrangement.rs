/*
 * @lc app=leetcode.cn id=526 lang=rust
 * @lcpr version=30304
 *
 * [526] 优美的排列
 */

// @lc code=start
impl Solution {
    /// 计算给定整数 n 的优美排列数量
    ///
    /// 优美排列定义：对于长度为 n 的数组 perm，满足以下任一条件：
    /// - perm[i] % i == 0 （元素能被位置整除）
    /// - i % perm[i] == 0 （位置能被元素整除）
    ///
    /// # 参数
    /// * `n` - 正整数，表示排列的长度
    ///
    /// # 返回值
    /// 返回满足优美排列条件的排列总数
    pub fn count_arrangement(n: i32) -> i32 {
        let mut arrangement_counter = ArrangementCounter::new();
        arrangement_counter.count_arrangement(n)
    }
}
/// 优美排列计数器结构体，封装了解决方案所需的所有状态变量
struct ArrangementCounter {
    /// 存储优美排列的总数
    res: i32,
    /// 记录回溯算法的递归路径，即每个索引选择的元素
    track: Vec<i32>,
    /// 标记元素是否已被使用的布尔数组，避免重复选择
    used: Vec<bool>,
}
impl ArrangementCounter {
    /// 创建一个新的排列计数器实例
    fn new() -> Self {
        Self {
            res: 0,
            track: vec![],
            used: vec![],
        }
    }

    /// 主函数：计算优美排列的数量
    ///
    /// # 算法思路
    /// 使用回溯算法，站在索引的视角选择元素：
    /// 1. 对于每个位置 index，尝试放置所有未使用的元素 elem
    /// 2. 检查是否满足优美排列的条件
    /// 3. 如果满足条件，则继续递归到下一个位置
    /// 4. 当所有位置都填满时，找到一个有效的优美排列
    ///
    /// # 参数
    /// * `n` - 正整数，表示排列的长度
    ///
    /// # 返回值
    /// 返回满足优美排列条件的排列总数
    fn count_arrangement(&mut self, n: i32) -> i32 {
        self.used = vec![false; (n + 1) as usize];
        self.track.clear();
        self.res = 0;
        self.backtrack(n, 1);
        self.res
    }
    /// 回溯算法核心函数，站在索引的视角选择元素
    ///
    /// # 参数
    /// * `n` - 排列的长度
    /// * `index` - 当前要填充的位置（从1开始）
    ///
    /// # 算法逻辑
    /// 1. Base case：如果 index > n，说明所有位置都已填满，找到一个有效解
    /// 2. 对于当前位置 index，尝试放置所有未使用的元素 elem
    /// 3. 剪枝：检查是否满足优美排列的条件
    /// 4. 做选择：标记元素为已使用，加入路径
    /// 5. 递归：进入下一个位置
    /// 6. 撤销选择：回溯，恢复状态
    fn backtrack(&mut self, n: i32, index: i32) {
        if index > n {
            self.res += 1;
            return;
        }
        for elem in 1..=n {
            if self.used[elem as usize] {
                continue;
            }
            if !(index % elem == 0 || elem % index == 0) {
                continue;
            }
            self.used[elem as usize] = true;
            self.track.push(elem);
            self.backtrack(n, index + 1);
            self.track.pop();
            self.used[elem as usize] = false;
        }
    }
}
// @lc code=end

/*
// @lcpr case=start
// 2\n
// @lcpr case=end

// @lcpr case=start
// 1\n
// @lcpr case=end

 */
