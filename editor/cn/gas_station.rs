/*
 * @lc app=leetcode.cn id=134 lang=rust
 * @lcpr version=30305
 *
 * [134] 加油站
 */

// @lc code=start
impl Solution {
    pub fn can_complete_circuit(gas: Vec<i32>, cost: Vec<i32>) -> i32 {
        let n = gas.len();
        let mut sum = 0;
        for i in 0..n {
            sum += gas[i] - cost[i];
        }
        if sum < 0 {
            return -1;
        }
        let mut tank = 0;
        let mut start: i32 = 0;
        for i in 0..n {
            tank += gas[i] - cost[i];
            if tank < 0 {
                tank = 0;
                start = i as i32 + 1;
            }
        }
        if start == n as i32 {
            return 0;
        }
        start
    }
}
// @lc code=end

/*
// @lcpr case=start
// [1,2,3,4,5]\n[3,4,5,1,2]\n
// @lcpr case=end

// @lcpr case=start
// [2,3,4]\n[3,4,3]\n
// @lcpr case=end

 */
