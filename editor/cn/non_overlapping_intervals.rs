/*
 * @lc app=leetcode.cn id=435 lang=rust
 * @lcpr version=30305
 *
 * [435] 无重叠区间
 */

// @lc code=start
impl Solution {
    /// 返回需要移除区间的最小数量，使剩余区间互不重叠。
    ///
    /// # Arguments
    /// * `intervals` - 一个二维整数向量，表示区间的集合，每个区间为 [start, end]。
    ///
    /// # Returns
    /// 返回需要移除的最小区间数量。
    pub fn erase_overlap_intervals(intervals: Vec<Vec<i32>>) -> i32 {
        // 处理空输入的边界情况
        if intervals.is_empty() {
            return 0;
        }

        // 1. 按照区间的结束时间进行升序排序
        // 使用 `to_vec()` 创建一个可变副本，因为函数参数是 `Vec<Vec<i32>>` 而不是 `&[Vec<i32>]`
        let mut sorted_intervals = intervals;
        sorted_intervals.sort_unstable_by_key(|interval| interval[1]);

        // 2. 贪心选择
        let mut count = 1; // 至少保留第一个区间
        let mut last_end = sorted_intervals[0][1]; // 记录上一个被保留区间的结束时间

        for i in 1..sorted_intervals.len() {
            let current_start = sorted_intervals[i][0];
            let current_end = sorted_intervals[i][1];

            // 如果当前区间的开始时间 >= 上一个保留区间的结束时间，则不重叠
            if current_start >= last_end {
                count += 1; // 保留当前区间
                last_end = current_end; // 更新结束时间为当前区间的结束时间
            }
            // 如果重叠，则当前区间被跳过（相当于被移除），count 不变
        }

        // 3. 计算结果：移除的数量 = 总数量 - 保留的数量
        (sorted_intervals.len() - count) as i32
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[1,2],[2,3],[3,4],[1,3]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,2],[1,2],[1,2]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,2],[2,3]]\n
// @lcpr case=end

 */
