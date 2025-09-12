/*
 * @lc app=leetcode.cn id=124 lang=cpp
 * @lcpr version=30203
 *
 * [124] 二叉树中的最大路径和
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
    int res=INT_MIN;
    int oneSideMax(TreeNode* root){
        if (root==nullptr) {
          return 0;
        }
        int leftMaxSum=max(0,oneSideMax(root->left));
        int rightMaxSum=max(0,oneSideMax(root->right));
        int PathMaxSum=root->val+leftMaxSum+rightMaxSum;
        res=max(res,PathMaxSum);
        return max(leftMaxSum,rightMaxSum)+root->val;

    }
public:
    int maxPathSum(TreeNode* root) {
        if (root==nullptr) {
          return 0;
        }
        oneSideMax(root);
        return res;
    }
};
// @lc code=end



/*
// @lcpr case=start
// [1,2,3]\n
// @lcpr case=end

// @lcpr case=start
// [-10,9,20,null,null,15,7]\n
// @lcpr case=end

 */

