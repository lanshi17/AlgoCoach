/*
 * @lc app=leetcode.cn id=744 lang=rust
 * @lcpr version=30307
 *
 * [744] 寻找比目标字母大的最小字母
 */

// @lc code=start
impl Solution {
    pub fn next_greatest_letter(letters: Vec<char>, target: char) -> char {
        letters[letters.partition_point(|x| *x <= target) % letters.len()]
    }
}
// @lc code=end



/*
// @lcpr case=start
// ["c","f","j"]\n"a"\n
// @lcpr case=end

// @lcpr case=start
// ["c","f","j"]\n"c"\n
// @lcpr case=end

// @lcpr case=start
// ["x","x","y","y"]\n"z"\n
// @lcpr case=end

 */

