/*
 * @lc app=leetcode.cn id=101 lang=cpp
 * @lcpr version=30203
 *
 * [101] 对称二叉树
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
    bool isSymmetric(TreeNode* root) {
       if (root==nullptr) {
         return false;
       } 
       return check(root->left,root->right);
    }
    private:
    bool check(TreeNode* left,TreeNode* right){
        if (left==nullptr||right==nullptr) {
          return left==right;
        }
        if (left->val!=right->val) {
          return false;
        }
        return check(left->right,right->left)&&check(left->left,right->right);
    }
};
// @lc code=end



/*
// @lcpr case=start
// [1,2,2,3,4,4,3]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,2,null,3,null,3]\n
// @lcpr case=end

 */

