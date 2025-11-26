/*
 * @lc app=leetcode.cn id=967 lang=rust
 * @lcpr version=30304
 *
 * [967] 连续差相同的数字
 */

// @lc code=start
impl Solution {
    pub fn nums_same_consec_diff(n: i32, k: i32) -> Vec<i32> {
        let mut res = Vec::new();
        Self::backtrack(n, k, &mut res, &mut 0i32, &mut 0i32);
        res
    }
    fn backtrack(
        n: i32,             //目标数字的位数
        k: i32,             //相邻两位数字差的绝对值
        res: &mut Vec<i32>, //存储所有满足条件的n位数字
        track: &mut i32,    //记录当前构建的数字
        digit: &mut i32,    //记录当前已构建的数字位数
    ) {
        if *digit == n {
            res.push(*track);
            return;
        }
        for i in 0..=9 {
            if *digit == 0 && i == 0 {
                continue;
            }
            if *digit > 0 && (i as i32 - *track % 10).abs() != k {
                continue;
            }
            *digit += 1;
            *track = *track * 10 + i as i32;
            Self::backtrack(n, k, res, track, digit);
            *digit -= 1;
            *track /= 10;
        }
    }
}
// @lc code=end

/*
// @lcpr case=start
// 3\n7\n
// @lcpr case=end

// @lcpr case=start
// 2\n1\n
// @lcpr case=end

 */
