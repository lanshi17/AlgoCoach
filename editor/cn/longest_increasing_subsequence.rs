/*
 * @lc app=leetcode.cn id=300 lang=rust
 * @lcpr version=30305
 *
 * [300] 最长递增子序列
 */

// @lc code=start
/// Finds the length of the longest increasing subsequence in the given array.
///
/// This function uses a greedy approach with binary search to efficiently compute
/// the length of the longest increasing subsequence (LIS). Instead of storing the
/// actual subsequence, it maintains an array where each position represents the
/// smallest tail element of all increasing subsequences of that length.
///
/// # Arguments
///
/// * `nums` - A vector of integers representing the input sequence
///
/// # Returns
///
/// An `i32` representing the length of the longest increasing subsequence
///
/// # Time Complexity
///
/// O(n log n) where n is the length of the input array, due to binary search
/// for each element
///
/// # Space Complexity
///
/// O(n) for the `top` array used to store the smallest tail elements
///
/// # Example
///
/// ```
/// let nums = vec![10, 9, 2, 5, 3, 7, 101, 18];
/// assert_eq!(Solution::length_of_lis(nums), 4); // [2, 3, 7, 101]
/// ```
impl Solution {
    /// 计算数组中最长严格递增子序列的长度
    ///
    /// 使用patience sorting算法思想，通过维护一个牌堆数组来模拟排序过程
    /// 对于每个元素，使用二分查找找到它应该放置的位置
    ///
    /// # 参数
    /// * `nums` - 输入的整数数组
    ///
    /// # 返回值
    /// 最长递增子序列的长度
    pub fn length_of_lis(nums: Vec<i32>) -> i32 {
        let mut top = vec![0; nums.len()];
        let mut piles = 0;
        for &poker in &nums {
            // 二分查找确定当前数字应该放在哪个牌堆
            let mut left = 0;
            let mut right = piles;
            while left < right {
                let mid = left + (right - left) / 2;
                if top[mid] >= poker {
                    right = mid;
                } else {
                    left = mid + 1;
                }
            }
            // 如果需要新建牌堆，则增加牌堆计数
            if left == piles {
                piles += 1;
            }
            // 将当前数字放到对应位置
            top[left] = poker;
        }
        piles as i32
    }
}
// @lc code=end

/*
// @lcpr case=start
// [10,9,2,5,3,7,101,18]\n
// @lcpr case=end

// @lcpr case=start
// [0,1,0,3,2,3]\n
// @lcpr case=end

// @lcpr case=start
// [7,7,7,7,7,7,7]\n
// @lcpr case=end

 */
