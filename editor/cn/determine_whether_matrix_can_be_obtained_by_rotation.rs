/*
 * @lc app=leetcode.cn id=1886 lang=rust
 * @lcpr version=30401
 *
 * [1886] 判断矩阵经轮转后是否一致
 */

// @lc code=start
impl Solution {
    pub fn find_rotation(mat: Vec<Vec<i32>>, target: Vec<Vec<i32>>) -> bool {
        let n = mat.len();
        let mut a = [0u16; 16];
        let mut b = [0u16; 16];

        #[inline]
        fn row_mask(row: &Vec<i32>) -> u16 {
            row.iter()
                .enumerate()
                .fold(0u16, |acc, (j, &v)| acc | ((v as u16) << j))
        }

        for i in 0..n {
            a[i] = row_mask(&mat[i]);
            b[i] = row_mask(&target[i]);
        }

        // 0°
        if (0..n).all(|i| a[i] == b[i]) {
            return true;
        }

        #[inline]
        fn reverse_n_bits(x: u16, n: usize) -> u16 {
            // 反转 16 位后右移，只保留 n 位
            x.reverse_bits() >> (16 - n)
        }

        // 180°
        if (0..n).all(|i| reverse_n_bits(a[n - 1 - i], n) == b[i]) {
            return true;
        }

        // 位级转置
        let t = transpose16(a);

        // 90°
        if (0..n).all(|i| reverse_n_bits(t[i], n) == b[i]) {
            return true;
        }

        // 270°
        if (0..n).all(|i| t[n - 1 - i] == b[i]) {
            return true;
        }

        false
    }
}
/// 16×16 位矩阵转置（SWAR 蝶形交换）
#[inline]
fn transpose16(mut x: [u16; 16]) -> [u16; 16] {
    const MASKS: [u16; 4] = [0xFF00, 0xF0F0, 0xCCCC, 0xAAAA];
    const SHIFTS: [usize; 4] = [8, 4, 2, 1];

    for (mask, shift) in MASKS.iter().zip(SHIFTS.iter()) {
        let step = *shift;
        let group = step * 2;
        let mut base = 0;
        while base < 16 {
            for i in 0..step {
                let i1 = base + i;
                let i2 = i1 + step;
                let t = (x[i1] ^ (x[i2] << step)) & *mask;
                x[i1] ^= t;
                x[i2] ^= t >> step;
            }
            base += group;
        }
    }

    x
}
// @lc code=end

/*
// @lcpr case=start
// [[0,1],[1,0]]\n[[1,0],[0,1]]\n
// @lcpr case=end

// @lcpr case=start
// [[0,1],[1,1]]\n[[1,0],[0,1]]\n
// @lcpr case=end

// @lcpr case=start
// [[0,0,0],[0,1,0],[1,1,1]]\n[[1,1,1],[0,1,0],[0,0,0]]\n
// @lcpr case=end

 */
