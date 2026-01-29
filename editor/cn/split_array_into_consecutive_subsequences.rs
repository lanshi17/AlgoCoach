/*
 * @lc app=leetcode.cn id=659 lang=rust
 * @lcpr version=30307
 *
 * [659] 分割数组为连续子序列
 */

// @lc code=start
use std::collections::HashMap;
impl Solution {
    pub fn is_possible(nums: Vec<i32>) -> bool {
        let mut freq: HashMap<i32, i32> = HashMap::new(); // 频率表
        let mut need: HashMap<i32, i32> = HashMap::new(); // 需求表
                                                          // 统计频率
        for &num in &nums {
            *freq.entry(num).or_insert(0) += 1;
        }
        // 遍历每个数字, 尝试将其放入某个子序列
        for &num in &nums {
            // 如果该数字已经被使用完, 则跳过
            if *freq.get(&num).unwrap() == 0 {
                continue;
            }
            // 尝试将该数字放入已有的子序列
            if *need.get(&num).unwrap_or(&0) > 0 {
                *need.entry(num).or_insert(0) -= 1; // 使用该数字
                *need.entry(num + 1).or_insert(0) += 1; // 下一个数字的需求增加
            } else if *freq.get(&(num + 1)).unwrap_or(&0) > 0
                && *freq.get(&(num + 2)).unwrap_or(&0) > 0
            {
                // 尝试新建一个子序列,需要num, num+1, num+2
                *freq.entry(num + 1).or_insert(0) -= 1;
                *freq.entry(num + 2).or_insert(0) -= 1;
                *need.entry(num + 3).or_insert(0) += 1;
            } else {
                // 既不能放入已有子序列, 也不能新建子序列, 则失败
                return false;
            }
            *freq.entry(num).or_insert(0) -= 1; // 使用该数字
        }

        true
    }
}
// @lc code=end

/*
// @lcpr case=start
// [1,2,3,3,4,5]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3,3,4,4,5,5]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3,4,4,5]\n
// @lcpr case=end

 */
