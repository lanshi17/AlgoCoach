/*
 * @lc app=leetcode.cn id=1415 lang=rust
 * @lcpr version=30400
 *
 * [1415] 长度为 n 的开心字符串中字典序第 k 小的字符串
 */

// @lc code=start
impl Solution {
    pub fn get_happy_string(n: i32, k: i32) -> String {
        let n = n as usize;
        let mut k = k as u128;

        // 总数：3 * 2^(n-1)
        let total = 3u128 * (1u128 << (n.saturating_sub(1) as u32));
        if k > total {
            return String::new();
        }
        let letters = ['a', 'b', 'c'];
        let mut ans: Vec<char> = Vec::with_capacity(n);
        let mut prev: Option<char> = None;
        for pos in 0..n {
            let rem = n - pos - 1; // 剩余位数
                                   // suffix_count = 2^rem，但为避免溢出/不必要的大数，封顶到 k
            let suffix_count = Self::pow2_capped(rem, k);

            let mut chosen = None;
            for &ch in &letters {
                if prev == Some(ch) {
                    continue;
                }
                // 以当前 ch 为这一位时，该分支包含 suffix_count 个字符串
                if k > suffix_count {
                    k -= suffix_count;
                } else {
                    chosen = Some(ch);
                    break;
                }
            }

            if let Some(ch) = chosen {
                ans.push(ch);
                prev = Some(ch);
            } else {
                // 理论上不会发生（除非输入异常），防御性返回空串
                return String::new();
            }
        }

        ans.into_iter().collect()
    }
    // 返回 min(2^rem, cap)，其中 cap 至少为当前 k（避免产生超大数或移位溢出）
    fn pow2_capped(rem: usize, cap: u128) -> u128 {
        // u128 最多安全左移 127 位；rem 很大时 2^rem 肯定 >= cap
        if rem >= 127 {
            return cap;
        }
        let v = 1u128 << (rem as u32);
        v.min(cap)
    }
}
// @lc code=end

/*
// @lcpr case=start
// 1\n3\n
// @lcpr case=end

// @lcpr case=start
// 1\n4\n
// @lcpr case=end

// @lcpr case=start
// 3\n9\n
// @lcpr case=end

 */
