/*
 * @lc app=leetcode.cn id=563 lang=cpp
 * @lcpr version=30203
 *
 * [563] 二叉树的坡度
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
    int res=0;
    int dfs(TreeNode* root){
        if (root==nullptr) {
          return 0;
        }
        int leftSum=dfs(root->left);
        int rightSum=dfs(root->right);
        res+=abs(leftSum-rightSum);
        return leftSum+rightSum+root->val;
    }
public:
    int findTilt(TreeNode* root) {
        if (root==nullptr) {
          return 0;
        }
        
        dfs(root);
        return res;
    }
    
};
// @lc code=end



/*
// @lcpr case=start
// [1,2,3]\n
// @lcpr case=end

// @lcpr case=start
// [4,2,9,3,5,null,7]\n
// @lcpr case=end

// @lcpr case=start
// [21,7,14,1,1,2,2,3,3]\n
// @lcpr case=end

 */

