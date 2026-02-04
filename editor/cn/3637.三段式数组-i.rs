/*
 * @lc app=leetcode.cn id=3637 lang=rust
 *
 * [3637] 三段式数组 I
 */

// @lc code=start
impl Solution {
   pub fn is_trionic(nums: Vec<i32>) -> bool {
    let n = nums.len();
    if n < 4 { return false; }

    let mut i = 0;
    while i+1<n &&nums[i]<nums[i+1]{
        i+=1;
    }
    let p=i;
    if p==0||p>=n-2{return false;}
    while i+1<n&&nums[i]>nums[i+1]{
        i+=1;
    }
    let q=i;
    if q==p||q>=n-1{return false;}
    while i+1<n&&nums[i]<nums[i+1]{
        i+=1;
    }
    i==n-1
    }
}
// @lc code=end

