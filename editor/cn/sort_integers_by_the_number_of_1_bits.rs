/*
 * @lc app=leetcode.cn id=1356 lang=rust
 * @lcpr version=30400
 *
 * [1356] 根据数字二进制下 1 的数目排序
 */

// @lc code=start
impl Solution {
    pub fn sort_by_bits(mut arr: Vec<i32>) -> Vec<i32> {
        arr.sort_unstable_by_key(|&num| {
            let ones_count = num.count_ones();
            (ones_count, num)
        });
        arr
    }
}
// @lc code=end

/*
// @lcpr case=start
// [0,1,2,3,4,5,6,7,8]\n
// @lcpr case=end

// @lcpr case=start
// [1024,512,256,128,64,32,16,8,4,2,1]\n
// @lcpr case=end

 */
