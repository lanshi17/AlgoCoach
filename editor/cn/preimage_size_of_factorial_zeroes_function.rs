/*
 * @lc app=leetcode.cn id=793 lang=rust
 * @lcpr version=30307
 *
 * [793] 阶乘函数后 K 个零
 */

// @lc code=start
impl Solution {
    pub fn preimage_size_fzf(k: i32) -> i32 {
        let k = k as i64;
        let right = right_bound(k);
        let left = left_bound(k);
        (right - left + 1) as i32
    }
}
fn trailing_zeroes(n: i64) -> i64 {
    let mut res = 0;
    let mut d = n;
    while d / 5 > 0 {
        res += d / 5;
        d /= 5;
    }
    res
}
/// 搜索 trailingZeroes(n) == target 的左侧边界
fn left_bound(target: i64) -> i64 {
    let mut lo = 0i64;
    let mut hi = i64::MAX; // Rust 中 i64 的最大值

    while lo < hi {
        let mid = lo + (hi - lo) / 2; // 防止 (lo + hi) 溢出
        let tz_mid = trailing_zeroes(mid);

        if tz_mid < target {
            lo = mid + 1;
        } else if tz_mid > target {
            hi = mid;
        } else {
            // 找到 target，收缩右边界以寻找左边界
            hi = mid;
        }
    }
    lo
}

/// 搜索 trailingZeroes(n) == target 的右侧边界
fn right_bound(target: i64) -> i64 {
    let mut lo = 0i64;
    let mut hi = i64::MAX;

    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        let tz_mid = trailing_zeroes(mid);

        if tz_mid < target {
            lo = mid + 1;
        } else if tz_mid > target {
            hi = mid;
        } else {
            // 找到 target，收缩左边界以寻找右边界
            lo = mid + 1;
        }
    }
    // 循环结束时，lo 指向第一个大于 target 的位置，所以减 1 得到右边界
    lo - 1
}

// @lc code=end

/*
// @lcpr case=start
// 0\n
// @lcpr case=end

// @lcpr case=start
// 5\n
// @lcpr case=end

// @lcpr case=start
// 3\n
// @lcpr case=end

 */
