/*
 * @lc app=leetcode.cn id=3296 lang=rust
 * @lcpr version=30400
 *
 * [3296] 移山所需的最少秒数
 */

// @lc code=start
impl Solution {
    pub fn min_number_of_seconds(mountain_height: i32, worker_times: Vec<i32>) -> i64 {
        let h = mountain_height as u128;
        if h == 0 {
            return 0;
        }

        let times: Vec<u128> = worker_times.into_iter().map(|x| x as u128).collect();
        let t_min = *times.iter().min().unwrap();

        // 上界：最快工人单独完成 H 的时间：t_min * H*(H+1)/2
        let high = t_min * h * (h + 1) / 2;

        let mut lo: u128 = 0;
        let mut hi: u128 = high;

        while lo < hi {
            let mid = (lo + hi) >> 1;
            if Self::can_finish(h, &times, mid) {
                hi = mid;
            } else {
                lo = mid + 1;
            }
        }

        lo as i64
    }
    fn can_finish(h: u128, times: &[u128], t: u128) -> bool {
        let mut sum: u128 = 0;

        for &ti in times {
            let q = t / ti;
            if q == 0 {
                continue;
            }

            // x = floor((sqrt(1+8q)-1)/2)
            let d = 1u128 + 8u128 * q;
            let s = Self::isqrt_u128(d);
            let x = (s - 1) / 2;

            sum += x;
            if sum >= h {
                return true;
            }
        }

        false
    }
    // 整数平方根：floor(sqrt(n))
    fn isqrt_u128(n: u128) -> u128 {
        if n <= 1 {
            return n;
        }

        // 用 f64 做初值（允许不精确），再向上/向下修正，保证正确
        let mut x = (n as f64).sqrt() as u128;

        while (x + 1) * (x + 1) <= n {
            x += 1;
        }
        while x * x > n {
            x -= 1;
        }
        x
    }
}
// @lc code=end

/*
// @lcpr case=start
// 4\n[2,1,1]\n
// @lcpr case=end

// @lcpr case=start
// 10\n[3,2,2,4]\n
// @lcpr case=end

// @lcpr case=start
// 5\n[1]\n
// @lcpr case=end

 */
