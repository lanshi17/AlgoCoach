/*
 * @lc app=leetcode.cn id=950 lang=rust
 * @lcpr version=30301
 *
 * [950] 按递增顺序显示卡牌
 */

// @lc code=start
use std::collections::VecDeque;
impl Solution {
    pub fn deck_revealed_increasing(mut deck: Vec<i32>) -> Vec<i32> {
        deck.sort_unstable();
        let mut queue = VecDeque::new();
        let n = deck.len();
        for i in (0..n).rev() {
            let prev = deck[i];
            if let Some(bottom) = queue.pop_back() {
                queue.push_front(bottom);
            }
            queue.push_front(prev);
        }
        queue.into_iter().collect()
    }
}
// @lc code=end

/*
// @lcpr case=start
// [17,13,11,2,3,5,7]\n
// @lcpr case=end

 */
