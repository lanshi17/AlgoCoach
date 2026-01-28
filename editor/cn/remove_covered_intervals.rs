/*
 * @lc app=leetcode.cn id=1288 lang=rust
 * @lcpr version=30307
 *
 * [1288] 删除被覆盖区间
 */

// @lc code=start
impl Solution {
    pub fn remove_covered_intervals(mut intervals: Vec<Vec<i32>>) -> i32 {
        // 按照起点升序排列，起点相同的按照终点降序排列
        intervals.sort_unstable_by(|a, b| {
            if a[0] == b[0] {
                b[1].cmp(&a[1])
            } else {
                a[0].cmp(&b[0])
            }
        });
        let mut count = 0;
        let mut right = 0;
        for interval in intervals {
            // 只有当当前区间的终点大于 right 时，才不是被覆盖的区间
            if interval[1] > right {
                count += 1;
                right = interval[1];
            }
        }
        count
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[1,4],[3,6],[2,8]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,4],[2,3]]\n
// @lcpr case=end

 */
