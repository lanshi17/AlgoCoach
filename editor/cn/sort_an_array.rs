/*
 * @lc app=leetcode.cn id=912 lang=rust
 * @lcpr version=30203
 *
 * [912] 排序数组
 */

// @lc code=start
impl Solution {
    pub fn sort_array(nums: Vec<i32>) -> Vec<i32> {
        if nums.len() <= 1 {
            return nums;
        }
        let mid = nums.len() / 2;
        let left = Self::sort_array(nums[..mid].to_vec());
        let right = Self::sort_array(nums[mid..].to_vec());
        Self::merge(left, right)
    }
    fn merge(vec1: Vec<i32>, vec2: Vec<i32>) -> Vec<i32> {
        let mut res = Vec::with_capacity(vec1.len() + vec2.len());
        let mut vec1_iter = vec1.into_iter();
        let mut vec2_iter = vec2.into_iter();

        let mut vec1_item = vec1_iter.next();
        let mut vec2_item = vec2_iter.next();
        while let (Some(val1), Some(val2)) = (&vec1_item, &vec2_item) {
            if val1 <= val2 {
                res.push(vec1_item.take().unwrap());
                vec1_item = vec1_iter.next();
            } else {
                res.push(vec2_item.take().unwrap());
                vec2_item = vec2_iter.next();
            }
        }
        if let Some(val) = vec1_item {
            res.push(val);
            res.extend(vec1_iter);
        }
        if let Some(val) = vec2_item {
            res.push(val);
            res.extend(vec2_iter);
        }
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// [5,2,3,1]\n
// @lcpr case=end

// @lcpr case=start
// [5,1,1,2,0,0]\n
// @lcpr case=end

 */
