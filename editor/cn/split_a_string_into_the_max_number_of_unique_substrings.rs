/*
 * @lc app=leetcode.cn id=1593 lang=rust
 * @lcpr version=30304
 *
 * [1593] 拆分字符串使唯一子字符串的数目最大
 */

// @lc code=start
use std::collections::HashSet;

impl Solution {
    /// 给定一个字符串 s ，请你把它分割成一些互不相同的子串，
    /// 使得分割出的子串数目最大。
    ///
    /// 约束条件:
    /// 1 <= s.length <= 16
    /// s 只包含小写英文字母
    ///
    /// 示例:
    /// 输入: s = "ababccc"
    /// 输出: 5
    /// 解释: 一种最大分割方案为 ["a", "b", "ab", "cc", "c"]
    ///
    pub fn max_unique_split(s: String) -> i32 {
        let mut used_substrings: HashSet<String> = HashSet::new();
        let mut max_count = 0;
        Self::backtrack(&s, 0, &mut used_substrings, &mut max_count);
        max_count
    }

    /// 回溯函数
    ///
    /// s: 原始字符串 (不变)
    /// start: 当前开始分割的索引
    /// used_substrings: 当前路径上已使用的子串集合
    /// max_count: 全局最大分割数 (可变引用)
    ///
    fn backtrack(
        s: &str,
        start: usize,
        used_substrings: &mut HashSet<String>,
        max_count: &mut i32,
    ) {
        // 剪枝：即使将剩余所有字符都单独分割，也无法超越当前最大值，则无需继续
        // 剩余字符数 = s.len() - start
        // 当前已有分割数 = used_substrings.len()
        // 潜在最大总数 = used_substrings.len() + (s.len() - start)
        if (used_substrings.len() + (s.len() - start)) as i32 <= *max_count {
            return;
        }
        // 基线条件：如果已处理完所有字符
        if start == s.len() {
            *max_count = (*max_count).max(used_substrings.len() as i32);
            return;
        }
        // 遍历所有可能的结束位置，形成子串 s[start..=end]
        for end in start..s.len() {
            let substring = s[start..=end].to_string();
            // 按照题目要求，不能有重复的子串
            if !used_substrings.contains(&substring) {
                // 做选择
                used_substrings.insert(substring.clone());
                // 递归：对剩余部分进行分割
                Self::backtrack(s, end + 1, used_substrings, max_count);
                // 撤销选择 (回溯)
                used_substrings.remove(&substring);
            }
        }
    }
}
// @lc code=end

/*
// @lcpr case=start
// "ababccc"\n
// @lcpr case=end

// @lcpr case=start
// "aba"\n
// @lcpr case=end

// @lcpr case=start
// "aa"\n
// @lcpr case=end

 */
