/*
 * @lc app=leetcode.cn id=2096 lang=cpp
 * @lcpr version=30202
 *
 * [2096] 从二叉树一个节点到另一个节点每一步的方向
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
    string getDirections(TreeNode* root, int startValue, int destValue) {
       this->startValue=startValue;
       this->destValue=destValue;
       dfs(root,startValue,destValue);
       int p=0,m=startPath.size(),n=destPath.size();
       while (p<m&&p<n&&startPath[p]==destPath[p]) {
         p++;
       } 
       startPath=startPath.substr(p);
       destPath=destPath.substr(p);
       startPath=string(startPath.size(),'U');
       return startPath+destPath;
    }
private:
    string path;
    int startValue;
    int destValue;
    string startPath;
    string destPath;
    void dfs(TreeNode* root,int startValue,int destValue){
        if (root==nullptr) {
          return;
        }
        if (root->val==startValue) {
          startPath=path;
        }else if (root->val==destValue)
        {   
            destPath=path;
        }
        path.push_back('L');
        dfs(root->left,startValue,destValue);
        path.pop_back();
        path.push_back('R');
        dfs(root->right,startValue,destValue);
        path.pop_back();
    }
};
// @lc code=end



/*
// @lcpr case=start
// [5,1,2,3,null,6,4]\n3\n6\n
// @lcpr case=end

// @lcpr case=start
// [2,1]\n2\n1\n
// @lcpr case=end

 */

