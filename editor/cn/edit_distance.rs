/*
 * @lc app=leetcode.cn id=72 lang=rust
 * @lcpr version=30305
 *
 * [72] 编辑距离
 */

// @lc code=start
use std::cmp::min;

impl Solution {
    pub fn min_distance(word1: String, word2: String) -> i32 {
        let chars1: Vec<char> = word1.chars().collect();
        let chars2: Vec<char> = word2.chars().collect();
        let m = chars1.len();
        let n = chars2.len();

        // TODO 1: 创建一个大小为 (n+1) 的 Vec<i32>，命名为 `dp`，并将其所有元素初始化为 0。
        let mut dp: Vec<i32> = vec![0; n + 1];
        // TODO 2: 使用一个 for 循环，将 `dp` 数组初始化。
        // 循环变量 `j` 从 0 到 n (包含 n)。
        // 在循环体内，设置 dp[j] = j as i32。
        // 这代表了将空字符串转换为 word2[..j] 所需的操作数。
        for j in 0..=n {
            dp[j] = j as i32;
        }
        // 迭代计算每一行 (i 从 1 到 m)
        for i in 1..=m {
            // `prev` 用于保存 `dp[i-1][j-1]` 的值。
            let mut prev = dp[0];
            // 更新 dp[0]，因为对于每一行 i，dp[0] 代表 word1[..i] -> "" 的距离，即 i。
            dp[0] = i as i32;

            // 迭代计算当前行的每一个元素 (j 从 1 到 n)
            for j in 1..=n {
                // `temp` 临时保存 `dp[j]` 的当前值。
                let temp = dp[j];

                if chars1[i - 1] == chars2[j - 1] {
                    // TODO 3: 如果字符相同，无需操作。
                    // 将 `dp[j]` 的值更新为 `prev`。
                    dp[j] = prev;
                } else {
                    // TODO 4: 如果字符不同，考虑三种操作并取最小值。
                    // 1. 替换: prev + 1
                    // 2. 删除: temp + 1 (temp 是更新前的 dp[j], 即 dp[i-1][j])
                    // 3. 插入: dp[j-1] + 1 (dp[j-1] 是本轮已更新的 dp[i][j-1])
                    // 使用 `min` 函数计算这三者的最小值，然后加 1，并赋值给 `dp[j]`。
                    dp[j] = min(prev, min(temp, dp[j - 1])) + 1;
                }

                // 更新 `prev`，为下一次内层循环做准备。
                prev = temp;
            }
        }

        // TODO 5: 循环结束后，返回 `dp` 数组的最后一个元素。
        dp[n]
    }
}
// @lc code=end

/*
// @lcpr case=start
// "horse"\n"ros"\n
// @lcpr case=end

// @lcpr case=start
// "intention"\n"execution"\n
// @lcpr case=end

 */
