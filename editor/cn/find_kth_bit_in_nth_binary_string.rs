/*
 * @lc app=leetcode.cn id=1545 lang=rust
 * @lcpr version=30400
 *
 * [1545] 找出第 N 个二进制字符串中的第 K 位
 */

// @lc code=start
impl Solution {
    pub fn find_kth_bit(n: i32, k: i32) -> char {
        fn helper(n: i32, k: i32) -> char {
            if n == 1 {
                return '0';
            }
            // 计算 Sn 的长度: len(Sn) = 2 * len(S_{n-1}) + 1
            // S1 长度为 1, S2 长度为 3 (2*1+1), S3 长度为 7 (2*3+1), ...
            // 所以 len(Sn) = 2^n - 1
            let len = (1 << n) - 1; // 1 << n 等价于 2^n
            let mid = (len >> 1) + 1; // 中点位置，即 2^(n-1) + 1
            if k == mid {
                '1'
            } else if k < mid {
                helper(n - 1, k)
            } else {
                let len_n_minus_1 = (1 << (n - 1)) - 1; //2^{n-1} - 1
                let corresponding_pos_in_original = len_n_minus_1 - (k - mid) + 1;
                let original_char = helper(n - 1, corresponding_pos_in_original);
                if original_char == '0' {
                    '1'
                } else {
                    '0'
                }
            }
        }
        helper(n, k)
    }
}
// @lc code=end

/*
// @lcpr case=start
// 3\n1\n
// @lcpr case=end

// @lcpr case=start
// 4\n11\n
// @lcpr case=end

 */
