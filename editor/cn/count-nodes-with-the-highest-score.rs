/*
 * @lc app=leetcode.cn id=2049 lang=rust
 * @lcpr version=30203
 *
 * [2049] 统计最高分的节点数目
 */

// @lc code=start
impl Solution {
    pub fn count_highest_score_nodes(parents: Vec<i32>) -> i32 {
        let n = parents.len();
        let mut children = vec![Vec::new(); n];
        for (i, &parent) in parents.iter().enumerate() {
            if parent != -1 {
                children[parent as usize].push(i);
            }
        }
        let mut subtree_sizes = vec![0; n];
        Self::dfs(0, &children, &mut subtree_sizes);
        let mut max_score = 0;
        let mut count = 0;
        for i in 0..n {
            let mut score: i64 = 1;
            let mut total_size = 0;
            for &child in &children[i] {
                let size = subtree_sizes[child];
                if size > 0 {
                    score *= size as i64;
                }
                total_size += size;
            }
            let remaining = n - 1 - total_size;
            if remaining > 0 {
                score *= remaining as i64;
            }
            if score > max_score {
                max_score = score;
                count = 1;
            } else if score == max_score {
                count += 1;
            }
        }
        count
    }
    fn dfs(node: usize, children: &Vec<Vec<usize>>, subtree_sizes: &mut Vec<usize>) -> usize {
        let mut size = 1;
        for &child in &children[node] {
            size += Self::dfs(child, children, subtree_sizes);
        }
        subtree_sizes[node] = size;
        size
    }
}
// @lc code=end

/*
// @lcpr case=start
// [-1,2,0,2,0]\n
// @lcpr case=end

// @lcpr case=start
// [-1,2,0]\n
// @lcpr case=end

 */
