/*
 * @lc app=leetcode.cn id=1584 lang=rust
 * @lcpr version=30304
 *
 * [1584] 连接所有点的最小费用
 */

// @lc code=start
use std::cmp::Reverse;
use std::collections::BinaryHeap;
impl Solution {
    pub fn min_cost_connect_points(points: Vec<Vec<i32>>) -> i32 {
        let n = points.len();
        let mut min_heap: BinaryHeap<Reverse<(i32, usize, usize)>> = BinaryHeap::new();
        let mut flags = vec![false; n];
        let mut min_cost = 0;
        let mut count = 1;

        flags[0] = true;
        for (i, point) in points.iter().enumerate() {
            if !flags[i] {
                let cost = Self::get_distance(&points[0], point);
                min_heap.push(Reverse((cost, i, 0_usize)));
            }
        }
        while let Some(Reverse((cost, to, from))) = min_heap.pop() {
            if flags[to] {
                continue;
            }
            flags[to] = true;
            min_cost += cost;
            count += 1;
            if count == n {
                break;
            }
            for (i, point) in points.iter().enumerate() {
                if !flags[i] {
                    let cost = Self::get_distance(&points[to], point);
                    min_heap.push(Reverse((cost, i, to)));
                }
            }
        }
        min_cost
    }
    fn get_distance(point_1: &Vec<i32>, point_2: &Vec<i32>) -> i32 {
        (point_1[0] - point_2[0]).abs() + (point_1[1] - point_2[1]).abs()
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[0,0],[2,2],[3,10],[5,2],[7,0]]\n
// @lcpr case=end

// @lcpr case=start
// [[3,12],[-2,5],[-4,1]]\n
// @lcpr case=end

 */
