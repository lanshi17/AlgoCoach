/*
 * @lc app=leetcode.cn id=842 lang=rust
 * @lcpr version=30307
 *
 * [842] 将数组拆分成斐波那契序列
 */

// @lc code=start
impl Solution {
    /// 将字符串拆分成斐波那契序列
    /// 给定一个数字字符串，尝试将其拆分成斐波那契数列
    /// 斐波那契数列满足 F(n) = F(n-1) + F(n-2)
    /// 返回拆分后的斐波那契数列
    /// 每个元素的取值范围是 [0, 2^31 - 1]，所以我们要在代码中加上这个判断，需要同时用字符串长度和 i64类型的值来判断。
    /// 直接转化成数字进行加法
    /// # Arguments
    /// ///
    /// * `num` - 一个数字字符串
    /// # Returns
    /// * 一个包含斐波那契数列的向量    
    pub fn split_into_fibonacci(num: String) -> Vec<i32> {
        let n = num.len();
        let num_bytes = num.as_bytes();
        let mut result = Vec::new();
        fn backtrack(num_bytes: &[u8], n: usize, index: usize, result: &mut Vec<i32>) -> bool {
            if index == n && result.len() >= 3 {
                return true;
            }
            let mut current_number: i64 = 0;
            for i in index..n {
                if i > index && num_bytes[index] == b'0' {
                    break;
                }
                current_number = current_number * 10 + (num_bytes[i] - b'0') as i64;
                if current_number > i32::MAX as i64 {
                    break;
                }
                let size = result.len();
                if size >= 2 {
                    let sum = result[size - 1] as i64 + result[size - 2] as i64;
                    if current_number < sum {
                        continue;
                    } else if current_number > sum {
                        break;
                    }
                }
                result.push(current_number as i32);
                if backtrack(num_bytes, n, i + 1, result) {
                    return true;
                }
                result.pop();
            }
            false
        }
        backtrack(&num_bytes, n, 0, &mut result);
        result
    }
}
// @lc code=end

/*
// @lcpr case=start
// "1101111"\n
// @lcpr case=end

// @lcpr case=start
// "112358130"\n
// @lcpr case=end

// @lcpr case=start
// "0123"\n
// @lcpr case=end

 */
