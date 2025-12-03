/*
 * @lc app=leetcode.cn id=996 lang=rust
 * @lcpr version=30304
 *
 * [996] 平方数组的数目
 */

// @lc code=start
impl Solution {
    pub fn num_squareful_perms(nums: Vec<i32>) -> i32 {
        let mut nums = nums.clone();
        nums.sort_unstable();
        let mut res = 0;
        let mut used = vec![false; nums.len()];
        let mut track = Vec::new();
        Self::backtrack(&nums, &mut res, &mut track, &mut used);
        res
    }
    fn backtrack(nums: &[i32], res: &mut i32, track: &mut Vec<i32>, used: &mut [bool]) {
        if track.len() == nums.len() {
            *res += 1;
            return;
        }
        for i in 0..nums.len() {
            if (i > 0 && nums[i] == nums[i - 1] && !used[i - 1]) || used[i] {
                continue;
            }
            if let Some(&last) = track.last() {
                if !Self::is_squareful(&last, &nums[i]) {
                    continue;
                }
            }

            track.push(nums[i]);
            used[i] = true;
            Self::backtrack(nums, res, track, used);
            track.pop();
            used[i] = false;
        }
    }
    fn is_squareful(a: &i32, b: &i32) -> bool {
        let sum = a + b;
        (sum as f64).sqrt() as i32 * (sum as f64).sqrt() as i32 == sum
    }
}
// @lc code=end

/*
// @lcpr case=start
// [1,17,8]\n
// @lcpr case=end

// @lcpr case=start
// [2,2,2]\n
// @lcpr case=end

 */
