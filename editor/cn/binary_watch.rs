/*
 * @lc app=leetcode.cn id=401 lang=rust
 * @lcpr version=30400
 *
 * [401] 二进制手表
 */

// @lc code=start
impl Solution {
    pub fn read_binary_watch(turned_on: i32) -> Vec<String> {
        let mut res = Vec::new();
        for mask in 0u32..1024u32 {
            if mask.count_ones() == turned_on as u32 {
                let hours = (mask >> 6) & 0xF;
                let minutes = mask & 0x3F;
                if hours <= 11 && minutes <= 59 {
                    // 格式化时间为 "H:MM" 或 "HH:MM" 并添加到结果列表
                    res.push(format!("{}:{:02}", hours, minutes));
                }
            }
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// 1\n
// @lcpr case=end

// @lcpr case=start
// 9\n
// @lcpr case=end

 */
