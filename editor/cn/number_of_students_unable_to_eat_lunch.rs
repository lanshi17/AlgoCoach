/*
 * @lc app=leetcode.cn id=1700 lang=rust
 * @lcpr version=30301
 *
 * [1700] 无法吃午餐的学生数量
 */

// @lc code=start
impl Solution {
    pub fn count_students(students: Vec<i32>, sandwiches: Vec<i32>) -> i32 {
        let mut count = vec![0; 2];
        for &student in &students {
            count[student as usize] += 1;
        }
        for &sandwich in &sandwiches {
            if count[sandwich as usize] > 0 {
                count[sandwich as usize] -= 1;
            } else {
                break;
            }
        }
        count[0] + count[1]
    }
}
// @lc code=end

/*
// @lcpr case=start
// [1,1,0,0]\n[0,1,0,1]\n
// @lcpr case=end

// @lcpr case=start
// [1,1,1,0,0,1]\n[1,0,0,0,1,1]\n
// @lcpr case=end

 */
