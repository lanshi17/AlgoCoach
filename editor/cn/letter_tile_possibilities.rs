/*
 * @lc app=leetcode.cn id=1079 lang=rust
 * @lcpr version=30304
 *
 * [1079] 活字印刷
 */

// @lc code=start
impl Solution {
    pub fn num_tile_possibilities(tiles: String) -> i32 {
        let mut tiles: Vec<char> = tiles.chars().collect();
        tiles.sort_unstable();
        let mut res = 0;
        let mut used = vec![false; tiles.len()];
        Self::backtrack(&tiles, &mut res, &mut used);
        res - 1
    }
    fn backtrack(tiles: &[char], res: &mut i32, used: &mut [bool]) {
        *res += 1;
        for i in 0..tiles.len() {
            if (i > 0 && tiles[i] == tiles[i - 1] && !used[i - 1]) || used[i] {
                continue;
            }
            used[i] = true;
            Self::backtrack(tiles, res, used);
            used[i] = false;
        }
    }
}
// @lc code=end

/*
// @lcpr case=start
// "AAB"\n
// @lcpr case=end

// @lcpr case=start
// "AAABBC"\n
// @lcpr case=end

// @lcpr case=start
// "V"\n
// @lcpr case=end

 */
