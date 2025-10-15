/*
 * @lc app=leetcode.cn id=215 lang=rust
 * @lcpr version=30203
 *
 * [215] 数组中的第K个最大元素
 */

// @lc code=start
use rand::Rng;

impl Solution {
    // 在子数组 [left, right] 中随机选择一个基准元素 pivot
    // 根据 pivot 重新排列子数组 [left, right]
    // 重新排列后，<= pivot 的元素都在 pivot 的左侧，>= pivot 的元素都在 pivot 的右侧
    // 返回 pivot 在重新排列后的 nums 中的下标
    // 特别地，如果子数组的所有元素都等于 pivot，我们会返回子数组的中心下标，避免退化
    fn partition(nums: &mut [i32], left: usize, right: usize) -> usize {
        // 1. 在子数组 [left, right] 中随机选择一个基准元素 pivot
        let mut rng = rand::thread_rng();
        let i = left + rng.gen_range(0..=right - left);
        let pivot = nums[i];
        // 把 pivot 与子数组第一个元素交换，避免 pivot 干扰后续划分，从而简化实现逻辑
        nums.swap(i, left);

        // 2. 相向双指针遍历子数组 [left + 1, right]
        // 循环不变量：在循环过程中，子数组的数据分布始终如下图
        // [ pivot | <=pivot | 尚未遍历 | >=pivot ]
        //   ^                 ^     ^         ^
        //   left              i     j         right

        let mut i = left + 1;
        let mut j = right;
        loop {
            while i <= j && nums[i] < pivot {
                i += 1;
            }
            // 此时 nums[i] >= pivot

            while i <= j && nums[j] > pivot {
                j -= 1;
            }
            // 此时 nums[j] <= pivot

            if i >= j {
                break;
            }

            // 维持循环不变量
            nums.swap(i, j);
            i += 1;
            j -= 1;
        }

        // 循环结束后
        // [ pivot | <=pivot | >=pivot ]
        //   ^             ^   ^     ^
        //   left          j   i     right

        // 3. 把 pivot 与 nums[j] 交换，完成划分（partition）
        // 为什么与 j 交换？
        // 如果与 i 交换，可能会出现 i = right + 1 的情况，已经下标越界了，无法交换
        // 而与 j 交换，即使 j = left，交换也不会出错
        nums.swap(left, j);

        // 交换后
        // [ <=pivot | pivot | >=pivot ]
        //               ^
        //               j

        // 返回 pivot 的下标
        j
    }

    pub fn find_kth_largest(mut nums: Vec<i32>, k: i32) -> i32 {
        let n = nums.len();
        let target_index = n - k as usize; // 第 k 大元素在升序数组中的下标是 n - k
        let mut left = 0;
        let mut right = n - 1; // 闭区间
        loop {
            let i = Self::partition(&mut nums, left, right);
            if i == target_index {
                // 找到第 k 大元素
                return nums[i];
            }
            if i > target_index {
                // 第 k 大元素在 [left, i - 1] 中
                right = i - 1;
            } else {
                // 第 k 大元素在 [i + 1, right] 中
                left = i + 1;
            }
        }
    }
}

// @lc code=end

/*
// @lcpr case=start
// 2\n
// @lcpr case=end

// @lcpr case=start
// 4\n
// @lcpr case=end

 */
