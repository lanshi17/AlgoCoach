/*
 * @lc app=leetcode.cn id=210 lang=rust
 * @lcpr version=30302
 *
 * [210] 课程表 II
 */

// @lc code=start
use std::collections::VecDeque;
impl Solution {
    pub fn find_order(num_courses: i32, prerequisites: Vec<Vec<i32>>) -> Vec<i32> {
        let num_courses = num_courses as usize;
        let mut indegree = vec![0; num_courses]; //入度
        let mut graph: Vec<Vec<usize>> = vec![vec![]; num_courses]; //有向
                                                                    //init
        for i in prerequisites.iter() {
            let course = i[0] as usize;
            let pre = i[1] as usize;
            graph[pre].push(course);
            indegree[course] += 1;
        }
        let mut q = VecDeque::new();
        for i in 0..num_courses {
            if indegree[i] == 0 {
                q.push_back(i);
            }
        }
        let mut res = Vec::new();
        while let Some(i) = q.pop_front() {
            res.push(i as i32);
            for j in graph[i].iter().map(|&x| x as usize) {
                indegree[j] -= 1;
                if indegree[j] == 0 {
                    q.push_back(j);
                }
            }
        }
        if res.len() == num_courses {
            res
        } else {
            vec![]
        }
    }
}
// @lc code=end

/*
// @lcpr case=start
// 2\n[[1,0]]\n
// @lcpr case=end

// @lcpr case=start
// 4\n[[1,0],[2,0],[3,1],[3,2]]\n
// @lcpr case=end

// @lcpr case=start
// 1\n[]\n
// @lcpr case=end

 */
