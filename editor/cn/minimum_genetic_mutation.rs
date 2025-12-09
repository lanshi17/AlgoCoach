/*
 * @lc app=leetcode.cn id=433 lang=rust
 * @lcpr version=30304
 *
 * [433] 最小基因变化
 */

// @lc code=start
use std::collections::{HashSet, VecDeque};
impl Solution {
    pub fn min_mutation(start_gene: String, end_gene: String, bank: Vec<String>) -> i32 {
        let bank: HashSet<String> = bank.into_iter().collect();
        if !bank.contains(&end_gene) {
            return -1;
        }
        let mut visited: HashSet<String> = HashSet::new();
        let mut queue: VecDeque<String> = VecDeque::new();
        queue.push_back(start_gene.clone());
        visited.insert(start_gene);
        let mut steps = 0;
        while !queue.is_empty() {
            let current_level_size = queue.len();
            for _ in 0..current_level_size {
                if let Some(current_gene) = queue.pop_front() {
                    if current_gene == end_gene {
                        return steps;
                    }
                    for new_gene in Self::get_all_mutations(&current_gene) {
                        if !visited.contains(&new_gene) && bank.contains(&new_gene) {
                            queue.push_back(new_gene.clone());
                            visited.insert(new_gene);
                        }
                    }
                }
            }
            steps += 1;
        }
        -1
    }
    fn get_all_mutations(genes: &str) -> Vec<String> {
        let mut mutations = Vec::new();
        let genes: Vec<char> = genes.chars().collect();
        let nucleotides = ['A', 'G', 'C', 'T'];
        for i in 0..genes.len() {
            let original_gene = genes[i];
            for &new_gene in &nucleotides {
                if new_gene != original_gene {
                    let mut new_genes = genes.clone();
                    new_genes[i] = new_gene;
                    mutations.push(new_genes.into_iter().collect());
                }
            }
        }
        mutations
    }
}
// @lc code=end

/*
// @lcpr case=start
// "AACCGGTT"\n"AACCGGTA"\n["AACCGGTA"]\n
// @lcpr case=end

// @lcpr case=start
// "AACCGGTT"\n"AAACGGTA"\n["AACCGGTA","AACCGCTA","AAACGGTA"]\n
// @lcpr case=end

 */
