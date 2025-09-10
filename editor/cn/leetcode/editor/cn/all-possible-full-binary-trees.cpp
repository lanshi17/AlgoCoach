/*
 * @lc app=leetcode.cn id=894 lang=cpp
 * @lcpr version=30203
 *
 * [894] 所有可能的真二叉树
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
    vector<TreeNode*> allPossibleFBT(int n) {
       if (n%2==0) {
         return vector<TreeNode*>();
       } 
       memo.resize(n+1);
       return build(n);
    }
private:
    vector<list<TreeNode*>> memo;
    vector<TreeNode*> build(int n){
        vector<TreeNode*> res;
        if (n==1) {
          res.push_back(new TreeNode(0));
          return res;
        }
        if (!memo[n].empty()) {
          return vector<TreeNode*>(memo[n].begin(),memo[n].end());
        }
        for (int i = 1; i < n; i+=2) {
          int j=n-i-1;
          vector<TreeNode*> leftSubTrees=build(i);
          vector<TreeNode*> rightSubTrees=build(j);
          for(auto left : leftSubTrees)
          {
            for(auto right : rightSubTrees)
            {
                TreeNode* root=new TreeNode(0);
                root->left=left;
                root->right=right;
                res.push_back(root);   
            } 
          }
        }
        memo[n]=list<TreeNode*>(res.begin(),res.end());
        return res;
    }
};
// @lc code=end



/*
// @lcpr case=start
// 7\n
// @lcpr case=end

// @lcpr case=start
// 3\n
// @lcpr case=end

 */

