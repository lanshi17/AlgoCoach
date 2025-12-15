/*
 * @lc app=leetcode.cn id=354 lang=rust
 * @lcpr version=30305
 *
 * [354] 俄罗斯套娃信封问题
 */

// @lc code=start
use std::cmp::Ordering;
impl Solution {
    pub fn max_envelopes(mut envelopes: Vec<Vec<i32>>) -> i32 {
        if envelopes.is_empty() {
            return 0;
        }
        envelopes.sort_by(|a, b| {
            if a[0] != b[0] {
                a[0].cmp(&b[0])
            } else {
                b[1].cmp(&a[1])
            }
        });
        let heights: Vec<i32> = envelopes.into_iter().map(|e| e[1]).collect();
        Self::length_of_lis(&heights) as i32
    }
    fn length_of_lis(nums: &[i32]) -> usize {
        let mut top = vec![0; nums.len()];
        let mut piles = 0;
        for &poker in nums {
            let mut left = 0;
            let mut right = piles;
            while left < right {
                let mid = left + (right - left) / 2;
                match top[mid].cmp(&poker) {
                    Ordering::Greater | Ordering::Equal => right = mid,
                    Ordering::Less => left = mid + 1,
                }
            }
            if left == piles {
                piles += 1;
            }
            top[left] = poker;
        }
        piles
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[5,4],[6,4],[6,7],[2,3]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,1],[1,1],[1,1]]\n
// @lcpr case=end

 */
