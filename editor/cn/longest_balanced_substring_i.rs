/*
 * @lc app=leetcode.cn id=3713 lang=rust
 * @lcpr version=30307
 *
 * [3713] 最长的平衡子串 I
 */

// @lc code=start
impl Solution {
    pub fn longest_balanced(s: String) -> i32 {
        let n = s.len();
        let s = s.as_bytes();
        let mut max_len = 0;
        for i in 0..n {
            let mut freq = vec![0; 26];
            for j in i..n {
                let ch = (s[j] - b'a') as usize;
                freq[ch] += 1;
                let mut flag = true;
                for k in 0..26 {
                    if freq[k] > 0 && freq[k] != freq[ch] {
                        flag = false;
                        break;
                    }
                }
                if flag {
                    max_len = max_len.max((j - i + 1) as i32);
                }
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
// "zzabccy"\n
// @lcpr case=end

// @lcpr case=start
// "aba"\n
// @lcpr case=end

 */
