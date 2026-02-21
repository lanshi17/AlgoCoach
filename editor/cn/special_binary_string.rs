/*
 * @lc app=leetcode.cn id=761 lang=rust
 * @lcpr version=30400
 *
 * [761] 特殊的二进制字符串
 */

// @lc code=start
impl Solution {
    pub fn make_largest_special(s: String) -> String {
        let mut count = 0;
        let mut start = 0;
        let mut res = Vec::new();
        for (i, c) in s.chars().enumerate() {
            if c == '1' {
                count += 1;
            } else {
                count -= 1;
            }
            if count == 0 {
                let sub_str = &s[start..=i];
                if sub_str.len() > 2 {
                    let inner_str = &sub_str[1..(sub_str.len() - 1)];
                    let processed_inner = Self::make_largest_special(inner_str.to_string());
                    res.push(format!("1{}0", processed_inner));
                } else {
                    res.push(sub_str.to_string());
                }
                start = i + 1;
            }
        }
        res.sort_unstable_by(|a, b| b.cmp(a));
        res.concat()
    }
}
// @lc code=end

/*
// @lcpr case=start
// "11011000"\n
// @lcpr case=end

// @lcpr case=start
// "10"\n
// @lcpr case=end

 */
