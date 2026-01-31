/*
 * @lc app=leetcode.cn id=391 lang=rust
 * @lcpr version=30307
 *
 * [391] 完美矩形
 */

// @lc code=start
use std::collections::HashSet;
impl Solution {
    pub fn is_rectangle_cover(rectangles: Vec<Vec<i32>>) -> bool {
        let mut x1_min=i32::MAX;
        let mut y1_min=i32::MAX;
        let mut x2_max=i32::MIN;
        let mut y2_max=i32::MIN;
        let mut points=HashSet::new();
        let mut actual_area=0i64;
        for rect in &rectangles{
            let x1=rect[0];
            let y1=rect[1];
            let x2=rect[2];
            let y2=rect[3];
            x1_min=x1_min.min(x1);
            y1_min=y1_min.min(y1);
            x2_max=x2_max.max(x2);
            y2_max=y2_max.max(y2);
            actual_area+=(x2 as i64 - x1 as i64) * (y2 as i64 - y1 as i64);
            let p1 = format!("{},{}", x1, y1);
            let p2 = format!("{},{}", x1, y2);
            let p3 = format!("{},{}", x2, y1);
            let p4 = format!("{},{}", x2, y2);
            for point in [p1, p2, p3, p4] {
                if points.contains(&point) {
                    points.remove(&point);
                } else {
                    points.insert(point);
                }
            }
        }
        let expected_area = (x2_max as i64 - x1_min as i64) * (y2_max as i64 - y1_min as i64);
        if actual_area != expected_area {
            return false;
        }
        if points.len() != 4 {
            return false;
        }
        let corner1 = format!("{},{}", x1_min, y1_min);
        let corner2 = format!("{},{}", x1_min, y2_max);
        let corner3 = format!("{},{}", x2_max, y1_min);
        let corner4 = format!("{},{}", x2_max, y2_max);
        if !points.contains(&corner1) || !points.contains(&corner2) ||
           !points.contains(&corner3) || !points.contains(&corner4) {
            return false;
        }
        true
    }
}
// @lc code=end



/*
// @lcpr case=start
// [[1,1,3,3],[3,1,4,2],[3,2,4,4],[1,3,2,4],[2,3,3,4]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,1,2,3],[1,3,2,4],[3,1,4,2],[3,2,4,4]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,1,3,3],[3,1,4,2],[1,3,2,4],[2,2,4,4]]\n
// @lcpr case=end

 */

