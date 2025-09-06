/*
 * @lc app=leetcode.cn id=1261 lang=cpp
 * @lcpr version=30202
 *
 * [1261] 在受污染的二叉树中查找元素
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
class FindElements {
public:
    FindElements(TreeNode* root) {
        dfs(root,0);    
    }
    void dfs(TreeNode* root,int val){
        if (root==nullptr) {
          return;
        }
        root->val=val;
        res.insert(val);
        dfs(root->left,2*val+1);
        dfs(root->right,2*val+2);
    }
    bool find(int target) {
        return res.count(target)>0;   
    }
private:
    unordered_set<int> res;
};

/**
 * Your FindElements object will be instantiated and called as such:
 * FindElements* obj = new FindElements(root);
 * bool param_1 = obj->find(target);
 */
// @lc code=end



/*
// @lcpr case=start
// ["FindElements","find","find"]\n[[[-1,null,-1]],[1],[2]]\n
// @lcpr case=end

// @lcpr case=start
// ["FindElements","find","find","find"]\n[[[-1,-1,-1,-1,-1]],[1],[3],[5]]\n
// @lcpr case=end

// @lcpr case=start
// ["FindElements","find","find","find","find"]\n[[[-1,null,-1,-1,null,-1]],[2],[3],[4],[5]]\n
// @lcpr case=end

 */

