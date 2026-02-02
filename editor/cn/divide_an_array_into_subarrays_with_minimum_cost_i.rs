/*
 * @lc app=leetcode.cn id=3010 lang=rust
 * @lcpr version=30307
 *
 * [3010] 将数组分成最小总代价的子数组 I
 */

// @lc code=start
impl Solution {
    pub fn minimum_cost(nums: Vec<i32>) -> i32 {
       let n=nums.len();
       if n==3{
            return nums.iter().sum();
       } 
       let mut first_min=i32::MAX;
       let mut second_min=i32::MAX;
       for i in 1..n{
            let x=nums[i];
            if x<first_min{
                second_min=first_min;
                first_min=x;
            }else if x<second_min{
                second_min=x;
            }
       }
       nums[0]+first_min+second_min
    }
}
// @lc code=end



/*
// @lcpr case=start
// [1,2,3,12]\n
// @lcpr case=end

// @lcpr case=start
// [5,4,3]\n
// @lcpr case=end

// @lcpr case=start
// [10,3,1,1]\n
// @lcpr case=end

 */

