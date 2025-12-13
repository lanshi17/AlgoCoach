/*
 * @lc app=leetcode.cn id=365 lang=rust
 * @lcpr version=30304
 *
 * [365] 水壶问题
 */

// @lc code=start
use std::collections::{HashSet, VecDeque};
impl Solution {
    //裴蜀定理
    pub fn can_measure_water(x: i32, y: i32, target: i32) -> bool {
        if target > x + y {
            return false;
        }
        let gcb_val = Self::gcb(x, y);
        target % gcb_val == 0
    }
    fn gcb(a: i32, b: i32) -> i32 {
        let mut a = a.abs();
        let mut b = b.abs();
        while b != 0 {
            let tmp = b;
            b = a % b;
            a = tmp;
        }
        a
    }
}
// @lc code=end

/*
// @lcpr case=start
// 3\n5\n4\n
// @lcpr case=end

 */
