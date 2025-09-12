/*
 * @lc app=leetcode.cn id=1145 lang=cpp
 * @lcpr version=30202
 *
 * [1145] 二叉树着色游戏
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
    bool btreeGameWinningMove(TreeNode* root, int n, int x) {
       TreeNode* node=find(root,x);
       int leftCount=count(node->left);
       int rightCount=count(node->right);
       int othersCount=n-1-leftCount-rightCount; 
       return max(leftCount,max(rightCount,othersCount))>n/2;
    }
private:
    TreeNode* find(TreeNode* root,int x){
        if (root==nullptr) {
          return nullptr;
        }
        if (root->val==x) {
          return root;
        }
        TreeNode* left= find(root->left,x);
        if (left!=nullptr) {
          return left;
        }
        return find(root->right,x);
    }
    int count(TreeNode* root){
        if (root==nullptr) {
          return 0;
        }
        return 1+count(root->left)+count(root->right);
    }
};
// @lc code=end



/*
// @lcpr case=start
// [1,2,3,4,5,6,7,8,9,10,11]\n11\n3\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3]\n3\n1\n
// @lcpr case=end

 */

