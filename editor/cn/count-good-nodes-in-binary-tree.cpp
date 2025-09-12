/*
 * @lc app=leetcode.cn id=1448 lang=cpp
 * @lcpr version=30202
 *
 * [1448] 统计二叉树中好节点的数目
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
public:
    int goodNodes(TreeNode* root) {
       dfs(root,root->val);
       return count; 
    }
private:
    int count=0;
    void dfs(TreeNode* root,int pathMax){
        if (root==nullptr) {
          return;
        }
        if (pathMax<=root->val) {
          pathMax=root->val;
          count++;
        }
        pathMax=max(pathMax,root->val);
        dfs(root->left,pathMax);
        dfs(root->right,pathMax);
    }
};
// @lc code=end



/*
// @lcpr case=start
// [3,1,4,3,null,1,5]\n
// @lcpr case=end

// @lcpr case=start
// [3,3,null,4,2]\n
// @lcpr case=end

// @lcpr case=start
// [1]\n
// @lcpr case=end

 */

