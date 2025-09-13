/*
 * @lc app=leetcode.cn id=897 lang=cpp
 * @lcpr version=30203
 *
 * [897] 递增顺序搜索树
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
    TreeNode* cur;
    
    void inorder(TreeNode* node) {
        if (node == nullptr) return;
        
        inorder(node->left);
        
        node->left = nullptr;
        cur->right = node;
        cur = node;
        
        inorder(node->right);
    }
    
public:
    TreeNode* increasingBST(TreeNode* root) {
        TreeNode* dummy = new TreeNode(0);
        cur = dummy;
        inorder(root);
        TreeNode* result = dummy->right;
        delete dummy;
        return result;
    }
};
// @lc code=end



/*
// @lcpr case=start
// [5,3,6,2,4,null,8,1,null,null,null,7,9]\n
// @lcpr case=end

// @lcpr case=start
// [5,1,7]\n
// @lcpr case=end

 */

