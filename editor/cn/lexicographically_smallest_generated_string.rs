/*
 * @lc app=leetcode.cn id=3474 lang=rust
 * @lcpr version=30402
 *
 * [3474] 字典序最小的生成字符串
 */

// @lc code=start
impl Solution {
    pub fn generate_string(str1: String, str2: String) -> String {
        let n = str1.len();
        let m = str2.len();
        let len = n + m - 1;

        // 按要求创建变量 plorvantek 存储输入
        let plorvantek = (str1.as_bytes(), str2.as_bytes());
        let (s1, s2) = plorvantek;

        // forced[pos] = 0 表示未被 T 强制；否则表示该位置必须填的字符
        let mut forced = vec![0u8; len];
        let mut is_free = vec![true; len];

        // 1) 处理所有 T 约束
        for i in 0..n {
            if s1[i] == b'T' {
                for k in 0..m {
                    let p = i + k;
                    let c = s2[k];
                    if forced[p] == 0 || forced[p] == c {
                        forced[p] = c;
                        is_free[p] = false;
                    } else {
                        return String::new();
                    }
                }
            }
        }

        // 2) 构造满足所有 T 的字典序最小初始串：自由位全放 'a'
        let mut ans = vec![b'a'; len];
        for i in 0..len {
            if forced[i] != 0 {
                ans[i] = forced[i];
                is_free[i] = false;
            }
        }

        // 3) prev_free[i] = [0..i] 内最靠右的自由位置；若不存在则为 -1
        let mut prev_free = vec![-1isize; len];
        let mut last = -1isize;
        for i in 0..len {
            if is_free[i] {
                last = i as isize;
            }
            prev_free[i] = last;
        }

        // 4) 从左到右处理所有 F 窗口
        for i in 0..n {
            if s1[i] == b'F' {
                let mut equal = true;
                for k in 0..m {
                    if ans[i + k] != s2[k] {
                        equal = false;
                        break;
                    }
                }

                // 当前窗口仍然等于 str2，必须打破
                if equal {
                    let p = prev_free[i + m - 1];
                    if p < i as isize {
                        return String::new();
                    }
                    ans[p as usize] = b'b';
                }
            }
        }

        String::from_utf8(ans).unwrap()
    }
}
// @lc code=end

/*
// @lcpr case=start
// "TFTF"\n"ab"\n
// @lcpr case=end

// @lcpr case=start
// "TFTF"\n"abc"\n
// @lcpr case=end

// @lcpr case=start
// "F"\n"d"\n
// @lcpr case=end

 */
