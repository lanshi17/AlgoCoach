/*
 * @lc app=leetcode.cn id=2305 lang=rust
 * @lcpr version=30304
 *
 * [2305] 公平分发饼干
 */

// @lc code=start
impl Solution {
    /// 主函数：计算分发饼干的最小不公平程度
    ///
    /// # Arguments
    /// * `cookies`: Vec<i32> - 每个零食包中的饼干数量
    /// * `k`: i32 - 孩子的数量
    ///
    /// # Returns
    /// * `i32` - 最小的不公平程度
    pub fn distribute_cookies(cookies: Vec<i32>, k: i32) -> i32 {
        let k = k as usize;
        let mut cookies = cookies;
        cookies.sort_unstable_by(|a, b| b.cmp(a));
        let left = *cookies.iter().max().unwrap_or(&0);
        let right = cookies.iter().sum::<i32>();
        Self::binary_search(&cookies, k, left, right)
    }
    fn binary_search(cookies: &[i32], k: usize, mut left: i32, mut right: i32) -> i32 {
        while left < right {
            let mid = left + (right - left) / 2;
            if Self::can_distribute(cookies, k, mid, 0, &mut vec![0; k]) {
                right = mid;
            } else {
                left = mid + 1;
            }
        }
        left
    }
    /// 回溯函数：检查在给定最大饼干数限制下，是否能完成分配
    ///
    /// # Arguments
    /// * `cookies`: &[i32] - 饼干数组
    /// * `k`: usize - 孩子数量
    /// * `max_allowed`: i32 - 每个孩子最多能分到的饼干数（二分搜索的中间值）
    /// * `cookie_index`: usize - 当前正在分配的饼干包索引
    /// * `buckets`: &mut [i32] - 记录每个孩子当前分到的饼干总数
    ///
    /// # Returns
    /// * `bool` - 如果能在限制下完成分配，返回 true；否则返回 false
    fn can_distribute(
        cookies: &[i32],
        k: usize,
        limit: i32,
        cookie_index: usize,
        buckets: &mut [i32],
    ) -> bool {
        if cookie_index == cookies.len() {
            return true;
        }
        let current_cookie = cookies[cookie_index];
        let mut visited_amounts = std::collections::HashSet::new();
        for child_idx in 0..k {
            let new_amount = buckets[child_idx] + current_cookie;
            if new_amount > limit {
                continue;
            }
            if !visited_amounts.insert(buckets[child_idx]) {
                continue;
            }
            buckets[child_idx] = new_amount;
            if Self::can_distribute(cookies, k, limit, cookie_index + 1, buckets) {
                return true;
            }
            buckets[child_idx] -= current_cookie;
        }
        false
    }
}
// @lc code=end

/*
// @lcpr case=start
// [8,15,10,20,8]\n2\n
// @lcpr case=end

// @lcpr case=start
// [6,1,3,2,2,4,1,2]\n3\n
// @lcpr case=end

 */
