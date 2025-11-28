/*
 * @lc app=leetcode.cn id=131 lang=rust
 * @lcpr version=30304
 *
 * [131] 分割回文串
 */

// @lc code=start
#[derive(Default)]
struct FindPalindromicStrings {
    res: Vec<Vec<String>>,
    track: Vec<String>,
}

impl FindPalindromicStrings {
    fn new() -> Self {
        Self::default()
    }

    fn backtrace(&mut self, s: &[char], start: usize) {
        if start == s.len() {
            self.res.push(self.track.clone());
            return;
        }

        for i in start..s.len() {
            if Self::is_palindromic(s, start, i) {
                // 直接从字符数组构造字符串，避免多次索引操作
                let substring: String = s[start..=i].iter().collect();
                self.track.push(substring);
                self.backtrace(s, i + 1);
                self.track.pop();
            }
        }
    }

    fn is_palindromic(s: &[char], mut lo: usize, mut hi: usize) -> bool {
        while lo < hi {
            if s[lo] != s[hi] {
                return false;
            }
            lo += 1;
            hi -= 1;
        }
        true
    }
}

impl Solution {
    pub fn partition(s: String) -> Vec<Vec<String>> {
        let mut find_palindromic_strings = FindPalindromicStrings::new();
        let chars: Vec<char> = s.chars().collect();
        find_palindromic_strings.backtrace(&chars, 0);
        find_palindromic_strings.res
    }
}

// @lc code=end

/*
// @lcpr case=start
// "aab"\n
// @lcpr case=end

// @lcpr case=start
// "a"\n
// @lcpr case=end

 */
