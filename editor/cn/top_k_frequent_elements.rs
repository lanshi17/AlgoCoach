/*
 * @lc app=leetcode.cn id=347 lang=rust
 * @lcpr version=30300
 *
 * [347] 前 K 个高频元素
 */

// @lc code=start
use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap};
impl Solution {
    pub fn top_k_frequent(nums: Vec<i32>, k: i32) -> Vec<i32> {
        use std::cmp::Reverse;
        use std::collections::{BinaryHeap, HashMap};

        let mut val_to_freq: HashMap<i32, i32> = HashMap::new();
        for num in nums {
            *val_to_freq.entry(num).or_insert(0) += 1;
        }

        let mut min_heap: BinaryHeap<Reverse<(i32, i32)>> = BinaryHeap::new(); // 存储 Reverse<(频率, 元素)>

        for (val, freq) in val_to_freq {
            if min_heap.len() < k as usize {
                min_heap.push(Reverse((freq, val)));
            } else if let Some(Reverse((top_freq, _))) = min_heap.peek() {
                if freq > *top_freq {
                    min_heap.pop();
                    min_heap.push(Reverse((freq, val)));
                }
            }
        }

        let mut res: Vec<i32> = Vec::with_capacity(k as usize);
        while let Some(Reverse((_, val))) = min_heap.pop() {
            res.push(val);
        }
        res.reverse();
        res
    }
}
// @lc code=end

/*
// @lcpr case=start
// [1,1,1,2,2,3]\n2\n
// @lcpr case=end

// @lcpr case=start
// [1]\n1\n
// @lcpr case=end

// @lcpr case=start
// [1,2,1,2,1,2,3,1,3,2]\n2\n
// @lcpr case=end

 */
