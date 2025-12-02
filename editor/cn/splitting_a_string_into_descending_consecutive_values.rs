/*
 * @lc app=leetcode.cn id=1849 lang=rust
 * @lcpr version=30304
 *
 * [1849] 将字符串拆分为递减的连续值
 */

// @lc code=start
impl Solution {
    pub fn split_string(s: String) -> bool {
        let mut solver = Solver::new(s);
        solver.backtrack(0);
        solver.found
    }
}

// 定义一个结构体来持有回溯过程中的状态
struct Solver {
    s_bytes: Vec<u8>,   // 原始字符串的字节表示，便于切片
    s_len: usize,       // 原始字符串长度
    track: Vec<String>, // 当前路径，存储分割后的字符串片段
    found: bool,        // 是否找到了符合条件的分割方案
}

impl Solver {
    // 构造函数，初始化求解器
    fn new(s: String) -> Self {
        Solver {
            s_bytes: s.clone().into_bytes(),
            s_len: s.len(),
            track: Vec::new(),
            found: false,
        }
    }

    // 回溯函数
    // start: 当前开始分割的位置
    fn backtrack(&mut self, start: usize) {
        // 剪枝：如果已经找到答案，立即停止所有递归
        if self.found {
            return;
        }

        // 基线条件：如果已处理完所有字符
        if start == self.s_len {
            // 检查是否至少形成了两个子串
            if self.track.len() >= 2 {
                self.found = true;
            }
            return;
        }

        // 遍历所有可能的结束位置，形成子串 s[start..=i]
        for i in start..self.s_len {
            // 获取当前子串的字节切片并转换为字符串
            let substr_bytes = &self.s_bytes[start..=i];
            let substr = unsafe { std::str::from_utf8_unchecked(substr_bytes) };

            // 计算前导零的数量
            let leading_zero_count = substr.bytes().take_while(|&b| b == b'0').count();

            // 强力剪枝：如果当前子串的有效数字长度超过原字符串的一半，则不可能满足条件
            // 因为后续数字需要递减且差值为1，第一个数不能太大。
            if substr.len() - leading_zero_count > (self.s_len + 1) / 2 {
                // 注意：此处使用return而非break，意味着放弃对当前start的所有后续探索。
                return;
            }

            // 尝试将子串解析为数字 (使用i64防止溢出)
            let current_num: i64 = match substr.parse() {
                Ok(num) => num,
                Err(_) => continue, // 解析失败则尝试下一个子串 (理论上不会发生)
            };

            // 检查当前数字是否符合序列规则 (前一个数 - 当前数 == 1)
            let is_sequence_valid = if let Some(last_str) = self.track.last() {
                // 如果路径非空，获取上一个数字
                if let Ok(last_num) = last_str.parse::<i64>() {
                    // 检查差值是否为1
                    last_num - current_num == 1
                } else {
                    false // 上一个数字解析失败 (理论上不会发生)
                }
            } else {
                // 如果是路径上的第一个数字，则总是有效
                true
            };

            // 如果当前选择有效
            if is_sequence_valid {
                // 做选择：将当前子串加入路径
                self.track.push(substr.to_string());
                // 递归进入下一层
                self.backtrack(i + 1);
                // 撤销选择：回溯
                self.track.pop();
            }
        }
    }
}
// @lc code=end

/*
// @lcpr case=start
// "1234"\n
// @lcpr case=end

// @lcpr case=start
// "050043"\n
// @lcpr case=end

// @lcpr case=start
// "9080701"\n
// @lcpr case=end

 */
