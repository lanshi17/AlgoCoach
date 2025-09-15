/*
 * @lc app=leetcode.cn id=508 lang=cpp
 * @lcpr version=30203
 *
 * [508] 出现次数最多的子树元素和
 */

// @lc code=start
/**
 * Definition for a binary tree node.
 * struct TreeNode {
 *     int val;
 *     TreeNode *left;
 *     TreeNode *right;
 *     TreeNode() : val(0), left(nullptr), right(nullptr) {}
 *     TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
 *     TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
 * };
 */
class Solution {
private:
    unordered_map<int,int> sumCount;
    int dfs(TreeNode* root){
        if (root==nullptr) {
          return 0;
        }
        int leftSum=dfs(root->left);
        int rightSum=dfs(root->right);
        int res=root->val+leftSum+rightSum;
        sumCount[res]=sumCount.count(res)?sumCount[res]+1:1;
        return res;
    }
public:
    vector<int> findFrequentTreeSum(TreeNode* root) {
    
        int maxCount=0;
        vector<int> res;
        dfs(root);
        for(auto e : sumCount)
        {
            maxCount=max(maxCount,e.second); 
        }
        for(auto e : sumCount)
        {
            if (e.second==maxCount) {
              res.push_back(e.first);
            }
        }
        return res;
    }
};
// @lc code=end



/*
// @lcpr case=start
// [5,2,-3]\n
// @lcpr case=end

// @lcpr case=start
// [5,2,-5]\n
// @lcpr case=end

 */

