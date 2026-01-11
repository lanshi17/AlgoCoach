/*
 * @lc app=leetcode.cn id=1024 lang=rust
 * @lcpr version=30306
 *
 * [1024] 视频拼接
 */

// @lc code=start
impl Solution {
    /// 使用给定的视频片段拼接出覆盖 [0, T] 的完整视频，返回所需的最少片段数量。
    ///
    /// # Arguments
    /// * `clips` - 一个二维整数向量，表示视频片段的集合，每个片段为 [start, end]。
    /// * `t` - 目标时间 T。
    ///
    /// # Returns
    /// 返回所需的最少片段数量，如果无法覆盖 [0, T]，则返回 -1。
    pub fn video_stitching(mut clips: Vec<Vec<i32>>, time: i32) -> i32 {
        if time == 0 {
            return 0;
        }
        clips.sort_unstable_by(|a, b| a[0].cmp(&b[0]).then_with(|| b[1].cmp(&a[1])));
        let mut res = 0; // 记录选择的视频片段数量
        let mut cur_end = 0; // 当前已拼接视频的最远结束时间
        let mut next_end = 0; // 在当前范围内能选到的下一个片段能达到的最远结束时间
        let mut i = 0; // 遍历 clips 的索引
        while i < clips.len() && clips[i][0] <= cur_end {
            while i < clips.len() && clips[i][0] <= cur_end {
                next_end = next_end.max(clips[i][1]);
                i += 1;
            }
            res += 1;
            cur_end = next_end;
            if cur_end >= time {
                return res;
            }
        }
        -1
    }
}
// @lc code=end

/*
// @lcpr case=start
// [[0,2],[4,6],[8,10],[1,9],[1,5],[5,9]]\n10\n
// @lcpr case=end

// @lcpr case=start
// [[0,1],[1,2]]\n5\n
// @lcpr case=end

// @lcpr case=start
// [[0,1],[6,8],[0,2],[5,6],[0,4],[0,3],[6,7],[1,3],[4,7],[1,4],[2,5],[2,6],[3,4],[4,5],[5,7],[6,9]]\n9\n
// @lcpr case=end

 */
