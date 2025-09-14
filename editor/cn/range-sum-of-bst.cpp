/*
 * @lc app=leetcode.cn id=938 lang=cpp
 * @lcpr version=30203
 *
 * [938] 二叉搜索树的范围和
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
public:
    int rangeSumBST(TreeNode* root, int low, int high) {
        if (root==nullptr) {
          return 0;
        }
        if (root->val<=high&&root->val>=low) {
          res+=root->val;
        }
        rangeSumBST(root->left,low,high);
        rangeSumBST(root->right,low,high);
        return res;
    }
};
// @lc code=end



/*
// @lcpr case=start
// [10,5,15,3,7,null,18]\n7\n15\n
// @lcpr case=end

// @lcpr case=start
// [10,5,15,3,7,13,18,1,null,6]\n6\n10\n
// @lcpr case=end

 */

