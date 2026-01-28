/*
 * @lc app=leetcode.cn id=56 lang=rust
 * @lcpr version=30307
 *
 * [56] 合并区间
 */

// @lc code=start
impl Solution {
    pub fn merge(mut intervals: Vec<Vec<i32>>) -> Vec<Vec<i32>> {
        intervals.sort_unstable_by(|a, b| a[0].cmp(&b[0])); // 按区间起点升序
        let mut res: Vec<Vec<i32>> = Vec::new();
        res.push(intervals[0].clone());
        for interval in intervals {
            if res.last().unwrap()[1] < interval[0] {
                res.push(interval);
            } else {
                let last = res.last_mut().unwrap();
                last[1] = last[1].max(interval[1]);
            }
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[1,3],[2,6],[8,10],[15,18]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,4],[4,5]]\n
// @lcpr case=end

// @lcpr case=start
// [[4,7],[1,4]]\n
// @lcpr case=end

 */
