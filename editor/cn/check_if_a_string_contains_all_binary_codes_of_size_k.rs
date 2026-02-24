/*
 * @lc app=leetcode.cn id=1461 lang=rust
 * @lcpr version=30400
 *
 * [1461] 检查一个字符串是否包含所有长度为 K 的二进制子串
 */

// @lc code=start
use std::collections::HashSet;

impl Solution {
    pub fn has_all_codes(s: String, k: i32) -> bool {
        let k = k as usize;

        // 如果 k 大于字符串长度，则不可能存在长度为 k 的子串
        if k > s.len() {
            return false;
        }

        // 计算我们需要找齐的总模式数
        let total_required_patterns = 1 << k; // 2^k

        // 使用 HashSet 存储所有遇到的长度为 k 的唯一子串
        let mut seen_substrings: HashSet<&str> = HashSet::new();

        // 遍历字符串 s，提取所有长度为 k 的子串
        // 使用 windows 迭代器，它会生成所有长度为 k 的连续子切片
        for substring_window in s.as_bytes().windows(k) {
            // 将字节切片转换回 &str
            let substring = std::str::from_utf8(substring_window).expect("Invalid UTF-8 found");

            // 将子串插入集合
            seen_substrings.insert(substring);

            // 如果已找到所有可能的模式，提前返回 true
            if seen_substrings.len() >= total_required_patterns {
                return true;
            }
        }

        // 检查是否找到了所有必需的模式
        seen_substrings.len() == total_required_patterns
    }
}
// @lc code=end

/*
// @lcpr case=start
// "00110110"\n2\n
// @lcpr case=end

// @lcpr case=start
// "0110"\n1\n
// @lcpr case=end

// @lcpr case=start
// "0110"\n2\n
// @lcpr case=end

 */
