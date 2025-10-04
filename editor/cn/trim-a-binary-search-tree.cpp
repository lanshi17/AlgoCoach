/*
 * @lc app=leetcode.cn id=669 lang=cpp
 * @lcpr version=30203
 *
 * [669] 修剪二叉搜索树
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
 *     TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left),
 * right(right) {}
 * };
 */
class Solution {
public:
  TreeNode *trimBST(TreeNode *root, int low, int high) {
    if (root == nullptr) {
      return nullptr;
    }
    while (root != nullptr && (root->val < low || root->val > high)) {
      if (root->val < low) {
        root = root->right;
      } else {
        root = root->left;
      }
    }
    if (root == nullptr) {
      return nullptr;
    }
    TreeNode *cur = root;
    while (cur->left != nullptr) {

      if (cur->left->val < low) {
        cur->left = cur->left->right;
      } else {
        cur = cur->left;
      }
    }
    cur = root;
    while (cur->right != nullptr) {
      if (cur->right->val > high) {
        cur->right = cur->right->left;
      } else {
        cur = cur->right;
      }
    }
    return root;
  }
};
// @lc code=end

/*
// @lcpr case=start
// [1,0,2]\n1\n2\n
// @lcpr case=end

// @lcpr case=start
// [3,0,4,null,2,null,null,1]\n1\n3\n
// @lcpr case=end

 */
