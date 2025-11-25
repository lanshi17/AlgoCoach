/*
 * @lc app=leetcode.cn id=22 lang=rust
 * @lcpr version=30304
 *
 * [22] 括号生成
 */

// @lc code=start
impl Solution {
    pub fn generate_parenthesis(n: i32) -> Vec<String> {
        if n == 0 {
            return vec![];
        }
        let mut res = Vec::new();
        let mut track = String::new();
        Self::backtrack(n, n, &mut res, &mut track);
        res
    }
    fn backtrack(left: i32, right: i32, res: &mut Vec<String>, track: &mut String) {
        if right < left {
            return;
        }
        if right < 0 || left < 0 {
            return;
        }
        if left == 0 && right == 0 {
            res.push(track.clone());
            return;
        }
        track.push('(');
        Self::backtrack(left - 1, right, res, track);
        track.pop();
        track.push(')');
        Self::backtrack(left, right - 1, res, track);
        track.pop();
    }
}
// @lc code=end

/*
// @lcpr case=start
// 3\n
// @lcpr case=end

// @lcpr case=start
// 1\n
// @lcpr case=end

 */
