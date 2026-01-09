/*
 * @lc app=leetcode.cn id=452 lang=rust
 * @lcpr version=30305
 *
 * [452] 用最少数量的箭引爆气球
 */

// @lc code=start
impl Solution {
    pub fn find_min_arrow_shots(mut points: Vec<Vec<i32>>) -> i32 {
        if points.is_empty() {
            return 0;
        }
        points.sort_unstable_by_key(|point| point[1]);
        let mut count = 1;
        let mut x_end = points[0][1];
        for point in &points {
            let mut start = point[0];
            if start > x_end {
                count += 1;
                x_end = point[1];
            }
        }
        return count;
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[10,16],[2,8],[1,6],[7,12]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,2],[3,4],[5,6],[7,8]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,2],[2,3],[3,4],[4,5]]\n
// @lcpr case=end

 */
