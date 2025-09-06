/*
 * @lc app=leetcode.cn id=386 lang=cpp
 * @lcpr version=30202
 *
 * [386] 字典序排数
 */

// @lc code=start
class Solution {
public:
    vector<int> lexicalOrder(int n) {
        for (int i = 1; i < 10; i++)
        {
           dfs(i,n);   
        }
        return res;
    }
    void dfs(int root,int val){
         if (root>val) {
           return;
         }
         res.push_back(root);
         for (int i = root*10; i < root*10+10; ++i) {
            dfs(i,val);
         }
    }
private:
    vector<int> res;
};
// @lc code=end



/*
// @lcpr case=start
// 13\n
// @lcpr case=end

// @lcpr case=start
// 2\n
// @lcpr case=end

 */

