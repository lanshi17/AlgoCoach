/*
 * @lc app=leetcode.cn id=2839 lang=rust
 * @lcpr version=30401
 *
 * [2839] 判断通过操作能否让字符串相等 I
 */

// @lc code=start
impl Solution {
    pub fn can_be_equal(s1: String, s2: String) -> bool {
        let a = s1.as_bytes();
        let b = s2.as_bytes();

        fn same_pair(x1: u8, x2: u8, y1: u8, y2: u8) -> bool {
            (x1 == y1 && x2 == y2) || (x1 == y2 && x2 == y1)
        }

        same_pair(a[0], a[2], b[0], b[2]) && same_pair(a[1], a[3], b[1], b[3])
    }
}
// @lc code=end

/*
// @lcpr case=start
// "abcd"\n"cdab"\n
// @lcpr case=end

// @lcpr case=start
// "abcd"\n"dacb"\n
// @lcpr case=end

 */
