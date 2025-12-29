/*
 * @lc app=leetcode.cn id=312 lang=rust
 * @lcpr version=30305
 *
 * [312] 戳气球
 */

// @lc code=start
impl Solution {
    /// 计算戳破所有气球所能获得的最大硬币数量。
    ///
    /// 使用动态规划。定义 dp[i][j] 为戳破区间 (i, j) 内所有气球的最大硬币数。
    /// 通过在区间内选择一个最后戳破的气球 k 来转移状态。
    ///
    /// # Arguments
    /// * `nums` - 包含每个气球上数字的数组。
    ///
    /// # Returns
    /// 返回所能获得的最大硬币数量。
    pub fn max_coins(nums: Vec<i32>) -> i32 {
        let n = nums.len();
        if n == 0 {
            return 0;
        }

        // 创建一个填充了边界的数组，两端为 1
        let mut padded_nums = Vec::with_capacity(n + 2);
        padded_nums.push(1);
        padded_nums.extend(nums);
        padded_nums.push(1);

        // dp[i][j] 表示戳破区间 (i, j) 内的气球所能获得的最大硬币数
        // 注意：区间 (i, j) 是开区间，不包含 i 和 j 位置的气球
        let mut dp = vec![vec![0; n + 2]; n + 2];

        // 按区间长度 l 从小到大遍历
        // l = 2: (i, i+2) -> 只有一个气球 i+1
        // l = 3: (i, i+3) -> 两个气球 i+1, i+2
        // ...
        for l in 2..=(n + 1) {
            // i 是区间的左端点
            for i in 0..=(n + 1 - l) {
                // j 是区间的右端点
                let j = i + l;
                // 尝试在区间 (i, j) 内的每个位置 k 戳破最后一个气球
                for k in (i + 1)..j {
                    // 戳破 k 的收益是 padded_nums[i] * padded_nums[k] * padded_nums[j]
                    // 加上戳破 (i, k) 和 (k, j) 区间的收益
                    let coins_from_bursting_k = padded_nums[i] * padded_nums[k] * padded_nums[j];
                    let total_coins = dp[i][k] + coins_from_bursting_k + dp[k][j];
                    // 更新 dp[i][j] 为最大值
                    dp[i][j] = dp[i][j].max(total_coins);
                }
            }
        }

        // dp[0][n+1] 表示戳破所有原始气球 (即区间 (0, n+1)) 的最大收益
        dp[0][n + 1]
    }
}
// @lc code=end

/*
// @lcpr case=start
// [3,1,5,8]\n
// @lcpr case=end

// @lcpr case=start
// [1,5]\n
// @lcpr case=end

 */
