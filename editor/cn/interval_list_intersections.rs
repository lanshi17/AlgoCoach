/*
 * @lc app=leetcode.cn id=986 lang=rust
 * @lcpr version=30307
 *
 * [986] 区间列表的交集
 */

// @lc code=start
impl Solution {
    pub fn interval_intersection(
        first_list: Vec<Vec<i32>>,
        second_list: Vec<Vec<i32>>,
    ) -> Vec<Vec<i32>> {
        let mut i = 0;
        let mut j = 0;
        let mut res = Vec::new();
        while i < first_list.len() && j < second_list.len() {
            // 找到重叠区间
            let start = first_list[i][0].max(second_list[j][0]); // 重叠区间的起点为两个区间起点的较大值
            let end = first_list[i][1].min(second_list[j][1]); // 重叠区间的终点为两个区间终点的较小值
            if start <= end {
                res.push(vec![start, end]);
            }
            if first_list[i][1] < second_list[j][1] {
                i += 1;
            } else {
                j += 1;
            }
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[0,2],[5,10],[13,23],[24,25]]\n[[1,5],[8,12],[15,24],[25,26]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,3],[5,9]]\n[]\n
// @lcpr case=end

 */
