/*
 * @lc app=leetcode.cn id=93 lang=rust
 * @lcpr version=30304
 *
 * [93] 复原 IP 地址
 */

// @lc code=start
#[derive(Default)]
struct BT {
    res: Vec<String>,
    track: Vec<String>,
}
impl BT {
    fn new() -> Self {
        Self::default()
    }
    fn backtrace(&mut self, s: &[char], start: usize) {
        if start == s.len() && self.track.len() == 4 {
            self.res.push(self.track.join("."));
            return;
        }
        if self.track.len() >= 4 {
            return;
        }
        for i in start..std::cmp::min(start + 3, s.len()) {
            if Self::is_valid(s, start, i) {
                self.track.push(s[start..=i].iter().collect());
                self.backtrace(s, i + 1);
                self.track.pop();
            }
        }
    }
    fn is_valid(s: &[char], start: usize, end: usize) -> bool {
        let length = end - start + 1;
        if length > 3 {
            return false;
        }
        if length == 1 {
            return true;
        }
        if s[start] == '0' {
            return false;
        }
        (start..=end).fold(0, |x, i| x * 10 + (s[i] as u8 - b'0') as i32) <= 255
    }
}
impl Solution {
    pub fn restore_ip_addresses(s: String) -> Vec<String> {
        let mut bt = BT::new();
        bt.backtrace(&s.chars().collect::<Vec<char>>(), 0);
        bt.res
    }
}
// @lc code=end

/*
// @lcpr case=start
// "25525511135"\n
// @lcpr case=end

// @lcpr case=start
// "0000"\n
// @lcpr case=end

// @lcpr case=start
// "101023"\n
// @lcpr case=end

 */
