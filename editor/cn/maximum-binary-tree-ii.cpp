/*
 * @lc app=leetcode.cn id=998 lang=cpp
 * @lcpr version=30203
 *
 * [998] 最大二叉树 II
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
    TreeNode* insertIntoMaxTree(TreeNode* root, int val) {
       if (root==nullptr)
       {
        return  new TreeNode(val);
       }
       if (root->val<val) {
         TreeNode* temp=root;
         root=new TreeNode(val);
         root->left=temp;
       }else
       {
        root->right=insertIntoMaxTree(root->right,val);
       }
       return root;
        
    }
};
// @lc code=end



/*
// @lcpr case=start
// [4,1,3,null,null,2]\n5\n
// @lcpr case=end

// @lcpr case=start
// [5,2,4,null,1]\n3\n
// @lcpr case=end

// @lcpr case=start
// [5,2,3,null,1]\n4\n
// @lcpr case=end

 */

