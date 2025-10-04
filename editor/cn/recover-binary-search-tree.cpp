/*
 * @lc app=leetcode.cn id=99 lang=cpp
 * @lcpr version=30203
 *
 * [99] 恢复二叉搜索树
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
    void recoverTree(TreeNode* root) {
        inorderTraverse(root);
        int temp=first->val;
        first->val=second->val;
        second->val=temp;
    }
private:
    TreeNode* first=nullptr;
    TreeNode* second=nullptr;
    TreeNode* prev=new TreeNode(INT_MIN);

    void inorderTraverse(TreeNode* root){
        if (root==nullptr) {
          return;
        }
        inorderTraverse(root->left);
        if (root->val<prev->val) {
          if (first==nullptr) {
            first=prev;
          }
          second=root;
        }
        prev=root;
        inorderTraverse(root->right);
    }
};
// @lc code=end



/*
// @lcpr case=start
// [1,3,null,null,2]\n
// @lcpr case=end

// @lcpr case=start
// [3,1,4,null,null,2]\n
// @lcpr case=end

 */

