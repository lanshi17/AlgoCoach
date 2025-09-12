/*
 * @lc app=leetcode.cn id=993 lang=cpp
 * @lcpr version=30202
 *
 * [993] 二叉树的堂兄弟节点
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
    bool isCousins(TreeNode* root, int x, int y) {
        this->x=x;
        this->y=y;
        dfs(root,0,nullptr);
        if (depthX==depthY&&parentX!=parentY) {
          return true;
        }
        return false;
    }
private:
    TreeNode* parentX=nullptr;
    TreeNode* parentY=nullptr;
    int depthX=0,depthY=0;
    int x,y;
    void dfs(TreeNode* root,int depth,TreeNode* parent){
        if (root==nullptr) {
          return;
        }
        if (root->val==x) {
          parentX=parent;
          depthX=depth;
        }
        if (root->val==y) {
          parentY=parent;
          depthY=depth;
        }
        dfs(root->left,depth+1,root);
        dfs(root->right,depth+1,root);
    }
};
// @lc code=end



/*
// @lcpr case=start
// [1,2,3,4]\n4\n3\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3,null,4,null,5]\n5\n4\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3,null,4]\n2\n3\n
// @lcpr case=end

 */

