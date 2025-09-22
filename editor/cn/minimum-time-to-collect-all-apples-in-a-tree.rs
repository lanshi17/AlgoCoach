/*
 * @lc app=leetcode.cn id=1443 lang=rust
 * @lcpr version=30203
 *
 * [1443] 收集树上所有苹果的最少时间
 */

// @lc code=start
use std::collections::{HashMap, HashSet};

impl Solution {
    pub fn min_time(n: i32, edges: Vec<Vec<i32>>, has_apple: Vec<bool>) -> i32 {
        let mut graph: HashMap<i32, Vec<i32>> = HashMap::new();
        
        for edge in &edges {
            let a = edge[0];
            let b = edge[1];
            graph.entry(a).or_insert_with(Vec::new).push(b);
            graph.entry(b).or_insert_with(Vec::new).push(a);
        }
        
        let (_, time) = Self::dfs(0, -1, &graph, &has_apple);
        time
    }

    fn dfs(
        node: i32,
        parent: i32,
        graph: &HashMap<i32, Vec<i32>>,
        has_apple: &Vec<bool>,
    ) -> (bool, i32) {
        let mut has_apple_in_subtree = has_apple[node as usize];
        let mut total_time = 0;
        
        if let Some(children) = graph.get(&node) {
            for &child in children {
            if child!=parent{ 
                let (child_has_apple, child_time) = Self::dfs(child, node, graph, has_apple);
                if child_has_apple {
                    has_apple_in_subtree = true;
                    total_time += child_time + 2;
                }
            }
            }
        }
        
        (has_apple_in_subtree, total_time)
    }
}

// @lc code=end



/*
// @lcpr case=start
// 7\n[[0,1],[0,2],[1,4],[1,5],[2,3],[2,6]]\n[false,false,true,false,true,true,false]\n
// @lcpr case=end

// @lcpr case=start
// 7\n[[0,1],[0,2],[1,4],[1,5],[2,3],[2,6]]\n[false,false,true,false,false,true,false]\n
// @lcpr case=end

// @lcpr case=start
// 7\n[[0,1],[0,2],[1,4],[1,5],[2,3],[2,6]]\n[false,false,false,false,false,false,false]\n
// @lcpr case=end

 */

