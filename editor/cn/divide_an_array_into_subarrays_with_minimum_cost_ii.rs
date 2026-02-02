/*
 * @lc app=leetcode.cn id=3013 lang=rust
 * @lcpr version=30307
 *
 * [3013] 将数组分成最小总代价的子数组 II
 */

// @lc code=start
use std::collections::BTreeSet;

impl Solution {
    pub fn minimum_cost(nums: Vec<i32>, k: i32, dist: i32) -> i64 {
        let n = nums.len();
        let k = (k - 1) as usize; // We need to pick k-1 more elements after nums[0]
        let dist = dist as usize;
        
        let mut small = BTreeSet::new(); // Stores the k-1 smallest (val, idx)
        let mut large = BTreeSet::new(); // Stores the rest in the window
        let mut current_sum: i64 = 0;

        // Helper to balance sets: move smallest from large to small if small is underfilled
        fn balance(small: &mut BTreeSet<(i32, usize)>, large: &mut BTreeSet<(i32, usize)>, k: usize, current_sum: &mut i64) {
            while small.len() < k && !large.is_empty() {
                let first = *large.iter().next().unwrap();
                large.remove(&first);
                small.insert(first);
                *current_sum += first.0 as i64;
            }
            while small.len() > k {
                let last = *small.iter().next_back().unwrap();
                small.remove(&last);
                large.insert(last);
                *current_sum -= last.0 as i64;
            }
        }

        // 1. Initialize with the first possible window [1, dist + 1]
        for i in 1..=std::cmp::min(n - 1, dist + 1) {
            large.insert((nums[i], i));
        }
        balance(&mut small, &mut large, k, &mut current_sum);
        
        let mut min_total = current_sum;

        // 2. Slide the window from [1, dist+1] to [n-dist-1, n-1]
        for i in (dist + 2)..n {
            let out_idx = i - dist - 1;
            let out_val = (nums[out_idx], out_idx);
            
            // Remove the element sliding out
            if small.contains(&out_val) {
                small.remove(&out_val);
                current_sum -= out_val.0 as i64;
            } else {
                large.remove(&out_val);
            }

            // Add the new element
            large.insert((nums[i], i));
            
            // Maintain k-1 smallest in 'small'
            balance(&mut small, &mut large, k, &mut current_sum);
            
            // If the first element in 'large' is smaller than the largest in 'small', swap
            if !small.is_empty() && !large.is_empty() {
                let s_max = *small.iter().next_back().unwrap();
                let l_min = *large.iter().next().unwrap();
                if l_min.0 < s_max.0 {
                    small.remove(&s_max);
                    large.remove(&l_min);
                    small.insert(l_min);
                    large.insert(s_max);
                    current_sum = current_sum - s_max.0 as i64 + l_min.0 as i64;
                }
            }

            min_total = min_total.min(current_sum);
        }

        (nums[0] as i64) + min_total
    }
}
// @lc code=end
/*
// @lcpr case=start
// [1,3,2,6,4,2]\n3\n3\n
// @lcpr case=end

// @lcpr case=start
// [10,1,2,2,2,1]\n4\n3\n
// @lcpr case=end

// @lcpr case=start
// [10,8,18,9]\n3\n1\n
// @lcpr case=end

 */

