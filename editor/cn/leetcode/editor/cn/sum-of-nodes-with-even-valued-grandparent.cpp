/*
 * @lc app=leetcode.cn id=1315 lang=cpp
 * @lcpr version=30202
 *
 * [1315] 祖父节点值为偶数的节点和
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
    int sumEvenGrandparent(TreeNode* root) {
       dfs(root);
       return sum; 
    }
private:
    int sum=0;
    void dfs(TreeNode* root){
        if (root==nullptr) {
          return;
        }
        if (root->val%2==0) {
          if (root->left!=nullptr) {
            if (root->left->left!=nullptr) {
              sum+=root->left->left->val;
            }
            if (root->left->right!=nullptr) {
              sum+=root->left->right->val;
            }
          }
            if (root->right != nullptr) {
                if (root->right->left != nullptr) {
                    sum += root->right->left->val;
                }
                if (root->right->right != nullptr) {
                    sum += root->right->right->val;
                }
            }
        }
        dfs(root->left);
        dfs(root->right);
    }
};
// @lc code=end



/*
// @lcpr case=start
// [6,7,8,2,7,1,3,9,null,1,4,null,null,null,5]\n
// @lcpr case=end

 */

