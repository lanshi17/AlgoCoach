/*
 * @lc app=leetcode.cn id=1980 lang=rust
 * @lcpr version=30400
 *
 * [1980] 找出不同的二进制字符串
 */

// @lc code=start
impl Solution {
    pub fn find_different_binary_string(nums: Vec<String>) -> String {
        nums.iter()
            .enumerate()
            .map(|(i, s)| if s.as_bytes()[i] == b'0' { '1' } else { '0' })
            .collect()
    }
}
// @lc code=end

/*
// @lcpr case=start
// ["01","10"]\n
// @lcpr case=end

// @lcpr case=start
// ["00","01"]\n
// @lcpr case=end

// @lcpr case=start
// ["111","011","001"]\n
// @lcpr case=end

 */
