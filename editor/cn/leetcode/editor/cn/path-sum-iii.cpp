/*
 * @lc app=leetcode.cn id=437 lang=cpp
 * @lcpr version=30202
 *
 * [437] 路径总和 III
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
    int pathSum(TreeNode* root, int targetSum) {
       if (root==nullptr) {
         return 0;
       }
       this->curPathSum=0;
       this->targetSum=targetSum;
       this->preSumCount[0]=1;
       dfs(root);
       return res;
    }
private:
    unordered_map<long long,int>preSumCount;
    long long curPathSum,targetSum;
    int res=0; 
    void dfs(TreeNode* root){
        if (root==nullptr) {
          return;
        }
        curPathSum+=root->val;
        res+=preSumCount[curPathSum-targetSum];
        preSumCount[curPathSum]+=1;

        dfs(root->left);
        dfs(root->right);
        preSumCount[curPathSum]-=1;
        curPathSum-=root->val;
    }
};
// @lc code=end



/*
// @lcpr case=start
// [10,5,-3,3,2,null,11,3,-2,null,1]\n8\n
// @lcpr case=end

// @lcpr case=start
// [5,4,8,11,null,13,4,7,2,null,null,5,1]\n22\n
// @lcpr case=end

 */

