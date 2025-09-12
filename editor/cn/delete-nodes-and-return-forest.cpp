/*
 * @lc app=leetcode.cn id=1110 lang=cpp
 * @lcpr version=30203
 *
 * [1110] 删点成林
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
    vector<TreeNode*> delNodes(TreeNode* root, vector<int>& to_delete) {
       for(auto d : to_delete)
       {
        delSet.insert(d);
       } 
       doDelete(root,false);
       return res;
    }
private:
    unordered_set<int> delSet;
    vector<TreeNode*> res;
    TreeNode* doDelete(TreeNode* root,bool hasParent){
        if (root==nullptr) {
          return nullptr;
        }
        bool deleted=delSet.count(root->val);
        if (!deleted&&!hasParent) {
          res.push_back(root);
        }
        root->left=doDelete(root->left,!deleted);
        root->right=doDelete(root->right,!deleted);
        return deleted?nullptr:root;
    }
};
// @lc code=end



/*
// @lcpr case=start
// [1,2,3,4,5,6,7]\n[3,5]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,4,null,3]\n[3]\n
// @lcpr case=end

 */

