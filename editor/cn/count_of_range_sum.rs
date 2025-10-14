/*
 * @lc app=leetcode.cn id=327 lang=rust
 * @lcpr version=30203
 *
 * [327] 区间和的个数
 */

// @lc code=start
impl Solution {
    pub fn count_range_sum(nums: Vec<i32>, lower: i32, upper: i32) -> i32 {
        let mut prefix_nums = vec![0i64];
        let mut sum: i64 = 0;
        for &num in &nums {
            sum += num as i64;
            prefix_nums.push(sum);
        }
        Self::merge_sort_count(&mut prefix_nums, lower as i64, upper as i64)
    }
    fn merge_sort_count(prefix_nums: &mut [i64], lower: i64, upper: i64) -> i32 {
        let n = prefix_nums.len();
        if n <= 1 {
            return 0;
        }
        let mid = n / 2;
        let mut count = 0;
        count += Self::merge_sort_count(&mut prefix_nums[0..mid], lower, upper);
        count += Self::merge_sort_count(&mut prefix_nums[mid..], lower, upper);
        count += Self::count_split_range(&prefix_nums[0..mid], &prefix_nums[mid..], lower, upper);
        Self::merge(prefix_nums, mid);
        count
    }
    fn count_split_range(sums_left: &[i64], sums_right: &[i64], lower: i64, upper: i64) -> i32 {
        let mut count = 0;
        for &sum_j in sums_right {
            let left_bound_val = sum_j - upper;
            let right_bound_val = sum_j - lower;
            let left = sums_left.partition_point(|&x| x < left_bound_val);
            let right = sums_left.partition_point(|&x| x <= right_bound_val);
            count += (right - left) as i32;
        }
        count
    }
    fn merge(prefix_nums: &mut [i64], mid: usize) {
        let left = &prefix_nums[0..mid];
        let right = &prefix_nums[mid..];
        let mut tmp = Vec::with_capacity(prefix_nums.len());
        let mut i = 0;
        let mut j = 0;
        while i < left.len() && j < right.len() {
            if left[i] <= right[j] {
                tmp.push(left[i]);
                i += 1;
            } else {
                tmp.push(right[j]);
                j += 1;
            }
        }
        tmp.extend_from_slice(&left[i..]);
        tmp.extend_from_slice(&right[j..]);
        prefix_nums.copy_from_slice(&tmp);
    }
}
// @lc code=end

/*
// @lcpr case=start
// [-2,5,-1]\n-2\n2\n
// @lcpr case=end

// @lcpr case=start
// [0]\n0\n0\n
// @lcpr case=end

 */
