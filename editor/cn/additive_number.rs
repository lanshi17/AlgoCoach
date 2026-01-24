/*
 * @lc app=leetcode.cn id=306 lang=rust
 * @lcpr version=30307
 *
 * [306] 累加数
 */

// @lc code=start
impl Solution {
    /// 判断字符串是否为累加数
    /// # 方法：枚举前两个数的切分位置，递归验证后续数字是否符合累加数定义
    /// # 复杂度分析
    /// - 时间复杂度：O(n^3)，其中 n 是字符串的长度。 枚举前两个数的切分位置需要 O(n^2) 的时间，每次验证后续数字需要 O(n) 的时间。
    /// - 空间复杂度：O(n)，用于存储字符串的切片和递归调用栈。
    pub fn is_additive_number(num: String) -> bool {
        let n = num.len();
        for i in 1..=n / 2 {
            for j in i + 1..n {
                if Self::check(&num, 0, i, j) {
                    return true;
                }
            }
        }
        false
    }
    /// 递归检查从位置 i, j, k 开始的数字是否符合累加数定义
    /// - `num`: 输入的数字字符串
    /// - `i`: 第一个数字的起始位置
    /// - `j`: 第二个数字的起始位置
    /// - `k`: 第三个数字的起始位置
    /// 返回值：如果从位置 i, j, k 开始的数字符合累加数定义，返回 true；否则返回 false
    fn check(num: &str, i: usize, j: usize, k: usize) -> bool {
        if num.as_bytes()[i] == '0' as u8 && j - i > 1 {
            return false;
        }
        if num.as_bytes()[j] == '0' as u8 && k - j > 1 {
            return false;
        }
        let n1 = &num[i..j];
        let n2 = &num[j..k];
        let sum = Self::string_add(n1, n2);
        let sum_len = sum.len();
        if k + sum_len > num.len() {
            return false;
        }
        if &num[k..k + sum_len] != sum {
            return false;
        }
        if k + sum_len == num.len() {
            return true;
        }
        Self::check(num, j, k, k + sum_len)
    }
    /// 字符串形式的两个非负整数相加
    /// - `n1`: 第一个非负整数的字符串表示
    /// - `n2`: 第二个非负整数的字符串表示
    /// 返回值：两个非负整数相加后的字符串表示
    fn string_add(n1: &str, n2: &str) -> String {
        let bytes1 = n1.as_bytes();
        let bytes2 = n2.as_bytes();
        let mut carry = 0;
        let mut res = Vec::new();
        let mut i = bytes1.len() as i32 - 1;
        let mut j = bytes2.len() as i32 - 1;
        while i >= 0 || j >= 0 || carry > 0 {
            let mut sum = carry;
            if i >= 0 {
                sum += (bytes1[i as usize] - b'0') as i32;
                i -= 1;
            }
            if j >= 0 {
                sum += (bytes2[j as usize] - b'0') as i32;
                j -= 1;
            }
            res.push((sum % 10) as u8 + b'0');
            carry = sum / 10;
        }
        res.reverse();
        String::from_utf8(res).unwrap()
    }
}
// @lc code=end

/*
// @lcpr case=start
// "112358"\n
// @lcpr case=end

// @lcpr case=start
// "199100199"\n
// @lcpr case=end

 */
