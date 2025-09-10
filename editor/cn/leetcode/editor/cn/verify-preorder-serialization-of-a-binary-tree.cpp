/*
 * @lc app=leetcode.cn id=331 lang=cpp
 * @lcpr version=30203
 *
 * [331] 验证二叉树的前序序列化
 */

// @lc code=start
class Solution {
public:
    bool isValidSerialization(string preorder) {
        int edge=1;
        stringstream ss(preorder);
        string node;
        while (getline(ss,node,',')) {
          if (node=="#") {
            edge--;
            if (edge<0) {
              return false;
            }

        }else
        {
            edge--;
            if (edge<0) {
              return false;
            }
            edge+=2;
        }
        }
        return edge==0;
    }
};
// @lc code=end



/*
// @lcpr case=start
// "9,3,4,#,#,1,#,#,2,#,6,#,#"\n
// @lcpr case=end

// @lcpr case=start
// "1,#"\n
// @lcpr case=end

// @lcpr case=start
// "9,#,#,1"\n
// @lcpr case=end

 */

