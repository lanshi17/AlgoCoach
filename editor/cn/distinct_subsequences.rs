/*
 * @lc app=leetcode.cn id=115 lang=rust
 * @lcpr version=30305
 *
 * [115] 不同的子序列
 */

// @lc code=start
use std::collections::HashMap;
#[derive(Eq, PartialEq, Hash)]
struct State {
    i: usize,
    j: usize,
}
impl Solution {
    pub fn num_distinct(s: String, t: String) -> i32 {
        let s_chars: Vec<char> = s.chars().collect();
        let t_chars: Vec<char> = t.chars().collect();
        let mut memo: HashMap<State, i32> = HashMap::new();
        Self::dp(&s_chars, 0, &t_chars, 0, &mut memo)
    }
    fn dp(s: &[char], i: usize, t: &[char], j: usize, memo: &mut HashMap<State, i32>) -> i32 {
        if j == t.len() {
            return 1;
        }
        if s.len() - i < t.len() - j {
            return 0;
        }
        let state = State {
            i,
            j,
        };
        if let Some(&cached_res) = memo.get(&state) {
            return cached_res;
        }
        let res = if s[i] == t[j] {
            Self::dp(s, i + 1, t, j + 1, memo) + Self::dp(s, i + 1, t, j, memo)
        } else {
            Self::dp(s, i + 1, t, j, memo)
        };
        memo.insert(state, res);
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// "rabbbit"\n"rabbit"\n
// @lcpr case=end

// @lcpr case=start
// "babgbag"\n"bag"\n
// @lcpr case=end

 */
