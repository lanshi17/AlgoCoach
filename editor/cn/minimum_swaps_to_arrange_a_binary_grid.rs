/*
 * @lc app=leetcode.cn id=1536 lang=rust
 * @lcpr version=30400
 *
 * [1536] 排布二进制网格的最少交换次数
 */

// @lc code=start
impl Solution {
    pub fn min_swaps(grid: Vec<Vec<i32>>) -> i32 {
        let n = grid.len();
        let mut tailing_zeros: Vec<usize> = grid
            .iter()
            .map(|row| row.iter().rev().position(|&cell| cell == 1).unwrap_or(n))
            .collect();

        let mut swaps = 0;

        for i in 0..n {
            let required_trailing_zeros = n - 1 - i;

            if let Some(j_offset_from_i) =
                tailing_zeros[i..n]
                    .iter()
                    .enumerate()
                    .find_map(|(idx, &zeros)| {
                        if zeros >= required_trailing_zeros {
                            Some(idx)
                        } else {
                            None
                        }
                    })
            {
                let j = i + j_offset_from_i;

                if j != i {
                    swaps += (j - i) as i32;

                    let val_to_move = tailing_zeros[j];
                    tailing_zeros.copy_within(i..j, i + 1);
                    tailing_zeros[i] = val_to_move;
                }
            } else {
                return -1;
            }
        }

        swaps
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[0,0,1],[1,1,0],[1,0,0]]\n
// @lcpr case=end

// @lcpr case=start
// [[0,1,1,0],[0,1,1,0],[0,1,1,0],[0,1,1,0]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,0,0],[1,1,0],[1,1,1]]\n
// @lcpr case=end

 */
