/*
 * @lc app=leetcode.cn id=572 lang=cpp
 * @lcpr version=30203
 *
 * [572] 另一棵树的子树
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
    bool isSubtree(TreeNode* root, TreeNode* subRoot) {
       if (root==nullptr) {
         return subRoot==nullptr;
       } 
       if (isSame(root,subRoot)) {
         return true;
       }
       return isSubtree(root->left,subRoot)||isSubtree(root->right,subRoot);
    }
private:
    bool isSame(TreeNode* p,TreeNode* q){
        if (q==nullptr&&p==nullptr) {
          return true;
        }
        if (q==nullptr||p==nullptr) {
          return false;
        }
        if (q->val!=p->val) {
          return false;
        }
        return isSame(p->left,q->left)&&isSame(p->right,q->right);

    }
};
// @lc code=end



/*
// @lcpr case=start
// [3,4,5,1,2]\n[4,1,2]\n
// @lcpr case=end

// @lcpr case=start
// [3,4,5,1,2,null,null,null,null,0]\n[4,1,2]\n
// @lcpr case=end

 */

