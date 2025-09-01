/*
 * @lc app=leetcode.cn id=971 lang=cpp
 * @lcpr version=30202
 *
 * [971] 翻转二叉树以匹配先序遍历
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
    vector<int> flipMatchVoyage(TreeNode* root, vector<int>& voyage) {
       this->voyage=voyage;
       dfs(root);
       if (canFlip) {
         return res;
       } 
       return {-1};
    }
private:
    vector<int> voyage;
    int i=0;
    vector<int> res;
    bool canFlip=true;
    void dfs(TreeNode* root){
        if (root==nullptr||!canFlip) {
          return;
        }
        if (root->val!=voyage[i++]) {
            canFlip=false;
          return;
        }
        if (root->left!=nullptr&&root->left->val!=voyage[i]) {
            TreeNode* temp=root->left;
            root->left=root->right;
            root->right=temp;

          res.push_back(root->val);
        }
        dfs(root->left);
        dfs(root->right);
    }
};
// @lc code=end



/*
// @lcpr case=start
// [1,2]\n[2,1]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3]\n[1,3,2]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3]\n[1,2,3]\n
// @lcpr case=end

 */

