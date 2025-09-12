/*
 * @lc app=leetcode.cn id=513 lang=cpp
 * @lcpr version=30202
 *
 * [513] 找树左下角的值
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
    int findBottomLeftValue(TreeNode* root) {
        dfs(root);
        return res->val;    
    }
private:
    int depth=0;
    int maxdepth=0;
    TreeNode* res=nullptr;
    void dfs(TreeNode* root){
        if (root==nullptr) {
          return;
        }
        depth++;
        if (depth>maxdepth) {
          maxdepth=depth;
          res=root;
        }
        dfs(root->left);
        dfs(root->right);
        depth--;
    }
};
// @lc code=end



/*
// @lcpr case=start
// [2,1,3]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3,4,null,5,6,null,null,7]\n
// @lcpr case=end

 */

