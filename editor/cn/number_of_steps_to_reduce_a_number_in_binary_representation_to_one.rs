/*
 * @lc app=leetcode.cn id=1404 lang=rust
 * @lcpr version=30400
 *
 * [1404] 将二进制表示减到 1 的步骤数
 */

// @lc code=start
impl Solution {
    pub fn num_steps(s: String) -> i32 {
        let n = s.len();
        if n == 1 {
            return 0;
        }
        let bytes = s.as_bytes();
        let mut res = 0;
        let mut meet1 = false;
        for i in (0..n).rev() {
            let pos = i;
            if bytes[i] == b'0' {
                res += if meet1 { 2 } else { 1 };
            } else {
                if !meet1 {
                    if pos != 0 {
                        res += 2;
                    }
                    meet1 = true;
                } else {
                    res += 1;
                }
            }
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// "1101"\n
// @lcpr case=end

// @lcpr case=start
// "10"\n
// @lcpr case=end

// @lcpr case=start
// "1"\n
// @lcpr case=end

 */
