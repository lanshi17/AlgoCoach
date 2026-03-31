/*
 * @lc app=leetcode.cn id=2840 lang=rust
 * @lcpr version=30401
 *
 * [2840] 判断通过操作能否让字符串相等 II
 */

// @lc code=start
impl Solution {
    pub fn check_strings(s1: String, s2: String) -> bool {
        let b1 = s1.as_bytes();
        let b2 = s2.as_bytes();
        let n = b1.len();

        let mut cnt = [[0i32; 26]; 2];

        for i in 0..n {
            let p = i & 1; // 0: 偶数位, 1: 奇数位
            cnt[p][(b1[i] - b'a') as usize] += 1;
            cnt[p][(b2[i] - b'a') as usize] -= 1;
        }

        cnt.iter().all(|row| row.iter().all(|&x| x == 0))
    }
}
// @lc code=end

/*
// @lcpr case=start
// "abcdba"\n"cabdab"\n
// @lcpr case=end

// @lcpr case=start
// "abe"\n"bea"\n
// @lcpr case=end

 */
