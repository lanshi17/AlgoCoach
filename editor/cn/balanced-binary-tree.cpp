/*
 * @lc app=leetcode.cn id=110 lang=cpp
 * @lcpr version=30203
 *
 * [110] 平衡二叉树
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
    bool isBalanced(TreeNode* root) {
       checkBalanced(root);
       return Balanced;
    }
private:
    bool Balanced=true;
    int checkBalanced(TreeNode* root){
        if (root==nullptr) {
          return 0;
        }
        int leftDepth=checkBalanced(root->left);
        int rightDepth=checkBalanced(root->right);

        if (abs(leftDepth-rightDepth)>1) {
          Balanced=false;
        }

        return 1+max(leftDepth,rightDepth);
    }
};
// @lc code=end



/*
// @lcpr case=start
// [3,9,20,null,null,15,7]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,2,3,3,null,null,4,4]\n
// @lcpr case=end

// @lcpr case=start
// []\n
// @lcpr case=end

 */

