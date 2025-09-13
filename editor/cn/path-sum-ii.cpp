/*
 * @lc app=leetcode.cn id=113 lang=cpp
 * @lcpr version=30203
 *
 * [113] 路径总和 II
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
    vector<vector<int>> pathSum(TreeNode* root, int targetSum) {

        vector<vector<int>> rootAnswer;
        if (root==nullptr) {
          return rootAnswer;
        }
        if (root->left==nullptr&&root->right==nullptr&&root->val==targetSum) {
            vector<int> Path;
            Path.push_back(root->val);
            rootAnswer.push_back(Path);
            return rootAnswer;
        }
        vector<vector<int>> leftAnswer=pathSum(root->left,targetSum-root->val);
        vector<vector<int>> rightAnswer=pathSum(root->right,targetSum-root->val);
        for(auto answer : leftAnswer)
        {
            answer.insert(answer.begin(),root->val);
            rootAnswer.push_back(answer);   
        } 
        for(auto answer : rightAnswer)
        {
           answer.insert(answer.begin(),root->val);
           rootAnswer.push_back(answer); 
        }
        return rootAnswer;
    }
};
// @lc code=end



/*
// @lcpr case=start
// [5,4,8,11,null,13,4,7,2,null,null,5,1]\n22\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3]\n5\n
// @lcpr case=end

// @lcpr case=start
// [1,2]\n0\n
// @lcpr case=end

 */

