/*
 * @lc app=leetcode.cn id=3714 lang=rust
 * @lcpr version=30307
 *
 * [3714] 最长的平衡子串 II
 */

// @lc code=start
use std::collections::HashMap;
impl Solution {
    pub fn longest_balanced(s: String) -> i32 {
        let n = s.len();
        let s = s.as_bytes();
        let mut max_len = 0;

        // 情况 1: 单一字符 (e.g., "aaaa")
        let mut i = 0;
        while i < n {
            let start = i;
            while i < n && s[i] == s[start] {
                i += 1;
            }
            max_len = max_len.max((i - start) as i32);
        }
        // 情况 2: 任意两种字符频率相等 (a=b, a=c, b=c)
        let pairs = [(b'a', b'b'), (b'a', b'c'), (b'b', b'c')];
        let others = [b'c', b'b', b'a']; // 对应 pairs 中不存在的第三种字符

        for j in 0..3 {
            let (c1, c2) = pairs[j];
            let other = others[j];
            let mut diff_map = HashMap::new();
            diff_map.insert(0, -1);
            let mut diff = 0;
            let mut last_other_pos = -1;
            for (idx, &ch) in s.iter().enumerate() {
                if ch == other {
                    // 如果遇到了不属于当前 pair 的字符，重置差值图
                    diff_map.clear();
                    diff_map.insert(0, idx as i32);
                    diff = 0;
                    last_other_pos = idx as i32;
                } else {
                    if ch == c1 {
                        diff += 1;
                    } else {
                        diff -= 1;
                    }

                    if let Some(&prev) = diff_map.get(&diff) {
                        max_len = max_len.max(idx as i32 - prev);
                    } else {
                        diff_map.insert(diff, idx as i32);
                    }
                }
            }
        }
        // 情况 3: 三种字符频率相等 (a=b=c)
        let mut triple_map = HashMap::new();
        triple_map.insert((0, 0), -1);
        let (mut a, mut b, mut c) = (0, 0, 0);
        for (idx, &ch) in s.iter().enumerate() {
            match ch {
                b'a' => a += 1,
                b'b' => b += 1,
                b'c' => c += 1,
                _ => {}
            }
            let key = (a - b, a - c);
            if let Some(&prev) = triple_map.get(&key) {
                max_len = max_len.max(idx as i32 - prev);
            } else {
                triple_map.insert(key, idx as i32);
            }
        }

        max_len
    }
}
// @lc code=end

/*
// @lcpr case=start
// "abbac"\n
// @lcpr case=end

// @lcpr case=start
// "aabcc"\n
// @lcpr case=end

// @lcpr case=start
// "aba"\n
// @lcpr case=end

 */
