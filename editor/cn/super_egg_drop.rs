/*
 * @lc app=leetcode.cn id=887 lang=rust
 * @lcpr version=30305
 *
 * [887] 鸡蛋掉落
 */

// @lc code=start
impl Solution {
    /// 计算确定临界楼层 f 所需的最小操作次数。
    ///
    /// 使用动态规划，dp[i][j] 表示使用 i 个鸡蛋和 j 次操作能确定的最大楼层数。
    /// 然后寻找最小的 j 使得 dp[k][j] >= n。
    ///
    /// # Arguments
    /// * `k` - 鸡蛋的数量。
    /// * `n` - 楼层数量。
    ///
    /// # Returns
    /// 返回确定 f 所需的最小操作次数。
    pub fn super_egg_drop(k: i32, n: i32) -> i32 {
        if n <= 1 {
            return n;
        }

        let k = k as i64;
        let n = n as i64;
        let mut left = 1_i64;
        let mut right = n;

        // 二分搜索最小操作次数 m，使得 m 次操作能覆盖至少 n 层楼。
        while left < right {
            let mid = left + (right - left) / 2;
            if Self::can_cover(mid, k, n) {
                right = mid;
            } else {
                left = mid + 1;
            }
        }
        left as i32
    }

    /// 判断给定操作次数 `moves` 与鸡蛋数量 `eggs` 是否能覆盖至少 `target` 层楼。
    fn can_cover(moves: i64, eggs: i64, target: i64) -> bool {
        let mut dp = vec![0_i64; (eggs + 1) as usize];

        for _ in 0..moves {
            for egg in (1..=eggs as usize).rev() {
                dp[egg] = dp[egg] + dp[egg - 1] + 1;
                if dp[egg] >= target {
                    return true;
                }
            }
        }

        false
    }
}
// @lc code=end

/*
// @lcpr case=start
// 1\n2\n
// @lcpr case=end

// @lcpr case=start
// 2\n6\n
// @lcpr case=end

// @lcpr case=start
// 3\n14\n
// @lcpr case=end

 */
