/*
 * @lc app=leetcode.cn id=67 lang=rust
 * @lcpr version=30307
 *
 * [67] 二进制求和
 */

// @lc code=start
impl Solution {
    pub fn add_binary(a: String, b: String) -> String {
        let mut a: Vec<u8> = a.into_bytes();
        let mut b: Vec<u8> = b.into_bytes();
        a.reverse();
        b.reverse();
        let mut res = Vec::new();
        let max_len = a.len().max(b.len());
        let mut carry = 0u8;
        let mut i = 0;
        while i < max_len || carry > 0 {
            let mut val = carry as u8;
            if i < a.len() {
                val += a[i] - b'0';
            }
            if i < b.len() {
                val += b[i] - b'0';
            }
            res.push((val % 2) + b'0');
            carry = val / 2;
            i += 1;
        }
        res.reverse();
        String::from_utf8(res).expect("REASON")
    }
}
// @lc code=end

/*
// @lcpr case=start
// "11"\n"1"\n
// @lcpr case=end

// @lcpr case=start
// "1010"\n"1011"\n
// @lcpr case=end

 */
