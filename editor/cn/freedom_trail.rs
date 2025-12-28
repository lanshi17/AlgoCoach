/*
 * @lc app=leetcode.cn id=514 lang=rust
 * @lcpr version=30305
 *
 * [514] 自由之路
 */

// @lc code=start
use std::collections::HashMap;

impl Solution {
    /// 计算拼写关键词所需的最少步数。
    ///
    /// 使用动态规划。
    /// `dp[i][j]` 表示拼写完 `key[0..i]` 并且 `ring[j]` 位于 12:00 方向时的最少步数。
    ///
    /// # Arguments
    /// * `ring`: 表示刻在外环上的编码。
    /// * `key`: 表示需要拼写的关键词。
    ///
    /// # Returns
    /// 返回拼写关键词所需的最少步数。
    pub fn find_rotate_steps(ring: String, key: String) -> i32 {
        let ring_chars: Vec<char> = ring.chars().collect();
        let key_chars: Vec<char> = key.chars().collect();
        let n = ring_chars.len();
        let m = key_chars.len();

        // 预处理：记录 ring 中每个字符的所有出现位置
        let mut char_positions: HashMap<char, Vec<usize>> = HashMap::new();
        for (i, &ch) in ring_chars.iter().enumerate() {
            char_positions.entry(ch).or_insert_with(Vec::new).push(i);
        }

        // dp[i][j] 表示拼写完 key[0..i] 且 ring[j] 在 12:00 方向的最少步数
        let mut dp = vec![vec![std::i32::MAX; n]; m];

        // 初始化 dp[0][j]：拼写 key[0]
        if let Some(pos_list) = char_positions.get(&key_chars[0]) {
            for &j in pos_list {
                // 从初始位置 0 旋转到位置 j 的最少步数 + 按下按钮的 1 步
                dp[0][j] = Self::min_distance(0, j, n) as i32 + 1;
            }
        }

        // 填充 dp 表
        for i in 1..m {
            if let Some(current_pos_list) = char_positions.get(&key_chars[i]) {
                for &j in current_pos_list {
                    // 遍历当前 key[i] 在 ring 中的所有可能位置 j
                    if let Some(prev_pos_list) = char_positions.get(&key_chars[i - 1]) {
                        for &k in prev_pos_list {
                            // 遍历上一个 key[i-1] 在 ring 中的所有可能位置 k
                            // 从 k 旋转到 j 的最少步数 + 按下按钮的 1 步 + 之前到达 k 的最少步数
                            let steps_from_k =
                                dp[i - 1][k] + Self::min_distance(k, j, n) as i32 + 1;
                            dp[i][j] = dp[i][j].min(steps_from_k);
                        }
                    }
                }
            }
        }

        // 找到拼写完所有 key 字符后，所有可能最终位置 j 中的最小步数
        if let Some(final_pos_list) = char_positions.get(&key_chars[m - 1]) {
            final_pos_list
                .iter()
                .map(|&j| dp[m - 1][j])
                .min()
                .unwrap_or(0) // 根据题意，保证有解，所以 min() 不会返回 None，unwrap_or(0) 是防御性编程
        } else {
            0 // 根据题意，key.last() 必然存在于 ring 中，此分支不会执行
        }
    }

    /// 计算 ring 上从位置 i 到位置 j 的最少旋转步数
    fn min_distance(i: usize, j: usize, n: usize) -> usize {
        let diff = i.max(j) - i.min(j);
        diff.min(n - diff)
    }
}
// @lc code=end

/*
// @lcpr case=start
// "godding"\n"gd"\n
// @lcpr case=end

// @lcpr case=start
// "godding"\n"godding"\n
// @lcpr case=end

 */
