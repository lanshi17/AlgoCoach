/*
 * @lc app=leetcode.cn id=207 lang=rust
 * @lcpr version=30302
 *
 * [207] 课程表
 */

// @lc code=starot
use std::collections::VecDeque;
impl Solution {
    pub fn can_finish(num_courses: i32, prerequisites: Vec<Vec<i32>>) -> bool {
        let num_courses = num_courses as usize;
        let mut indegree: Vec<i32> = vec![0; num_courses]; //入度list
        let mut graph: Vec<Vec<usize>> = vec![vec![]; num_courses]; //有向图
        for prereq in prerequisites.iter() {
            let course = prereq[0] as usize;
            let pre_course = prereq[1] as usize;
            graph[pre_course].push(course);
            indegree[course] += 1;
        }
        let mut q = VecDeque::new();
        for i in 0..num_courses {
            if indegree[i] == 0 {
                q.push_back(i);
            }
        }
        let mut count = 0;
        while let Some(i) = q.pop_front() {
            count += 1;
            for j in graph[i].iter().map(|&x| x as usize) {
                indegree[j] -= 1;
                if indegree[j] == 0 {
                    q.push_back(j);
                }
            }
        }
        count == num_courses
    }
}
// @lc code=end

/*
// @lcpr case=start
// 2\n[[1,0]]\n
// @lcpr case=end

// @lcpr case=start
// 2\n[[1,0],[0,1]]\n
// @lcpr case=end

 */
