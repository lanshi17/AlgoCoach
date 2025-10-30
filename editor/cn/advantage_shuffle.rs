/*
 * @lc app=leetcode.cn id=870 lang=rust
 * @lcpr version=30300
 *
 * [870] 优势洗牌
 */

// @lc code=start
use std::collections::BinaryHeap;
impl Solution {
    pub fn advantage_count(mut nums1: Vec<i32>, mut nums2: Vec<i32>) -> Vec<i32> {
        let n = nums1.len();
        let mut max_heap: BinaryHeap<(i32, usize)> = nums2
            .into_iter()
            .enumerate()
            .map(|(idx, val)| (val, idx))
            .collect();
        nums1.sort_unstable();
        let mut left: usize = 0;
        let mut right = n - 1;
        let mut res = vec![0; n];
        while let Some((max_val, idx)) = max_heap.pop() {
            if nums1[right] > max_val {
                res[idx] = nums1[right];
                if right == 0 {
                    break;
                };
                right -= 1;
            } else {
                res[idx] = nums1[left];
                left += 1;
            }
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// [2,7,11,15]\n[1,10,4,11]\n
// @lcpr case=end

// @lcpr case=start
// [12,24,8,32]\n[13,25,32,11]\n
// @lcpr case=end

 */
