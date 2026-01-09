/*
 * @lc app=leetcode.cn id=1235 lang=rust
 * @lcpr version=30305
 *
 * [1235] 规划兼职工作
 */

// @lc code=start
use std::collections::BTreeMap;

impl Solution {
    /// 在给定任务列表的情况下，计算可以获得的最大利润。
    /// 每个任务有开始时间、结束时间和利润。不能同时执行多个任务。
    ///
    /// # Arguments
    /// * `start_time` - 任务开始时间的向量。
    /// * `end_time` - 任务结束时间的向量。
    /// * `profit` - 任务利润的向量。
    ///
    /// # Returns
    /// 返回可以获得的最大利润。
    pub fn job_scheduling(start_time: Vec<i32>, end_time: Vec<i32>, profit: Vec<i32>) -> i32 {
        let n = profit.len();

        // 1. 构造任务列表并按结束时间排序
        // 使用索引元组来关联三个数组，然后排序
        let mut jobs: Vec<(i32, i32, i32)> = (0..n)
            .map(|i| (start_time[i], end_time[i], profit[i]))
            .collect();

        // 按结束时间升序排序
        jobs.sort_unstable_by_key(|job| job.1);

        // 2. 使用 BTreeMap 实现有序映射，模拟原 C++ 的 map
        // 键是时间点，值是到该时间点为止的最大利润
        let mut dp: BTreeMap<i32, i32> = BTreeMap::new();
        // Base case: 没有工作时利润为 0
        dp.insert(0, 0);

        // 3. 遍历排序后的任务，进行状态转移
        for (begin, end, value) in jobs {
            let prev_profit = dp
                .range(..=&begin)
                .next_back()
                .map(|(_k, &v)| v) // 解构 (key, &value)，提取 value
                .unwrap_or(0); // 如果没找到（例如 begin < 最小key），则为 0

            // 获取当前已知的最大利润
            let current_max_profit = *dp.iter().next_back().unwrap().1; // unwrap 安全，因为 base case 存在

            // 计算两种选择下的利润
            let profit_if_take = prev_profit + value;
            let profit_if_skip = current_max_profit;

            // 状态转移：更新 dp[end]，取两种选择的最大值
            let new_profit_at_end = profit_if_take.max(profit_if_skip);
            dp.insert(end, new_profit_at_end);
        }
        *dp.iter().next_back().unwrap().1
    }
}
// @lc code=end

/*
// @lcpr case=start
// [1,2,3,3]\n[3,4,5,6]\n[50,10,40,70]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3,4,6]\n[3,5,10,6,9]\n[20,20,100,70,60]\n
// @lcpr case=end

// @lcpr case=start
// [1,1,1]\n[2,3,4]\n[5,6,4]\n
// @lcpr case=end

 */
