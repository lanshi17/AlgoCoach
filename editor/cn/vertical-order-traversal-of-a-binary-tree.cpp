/*
 * @lc app=leetcode.cn id=987 lang=cpp
 * @lcpr version=30202
 *
 * [987] 二叉树的垂序遍历
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
    vector<vector<int>> verticalTraversal(TreeNode* root) {
        dfs(root,0,0);
        sort(nodes.begin(),nodes.end(),[](Triple a,Triple b){
            if (a.col==b.col&&a.row==b.row) {
              return a.node->val<b.node->val;
            }
            if (a.col==b.col) {
              return a.row<b.row;
            }
            return a.col<b.col;
        });
        vector<vector<int>> res;
        int preCol=INT_MIN;
        for (int i = 0; i < nodes.size(); ++i) {
          Triple cur=nodes[i];
          if (cur.col!=preCol) {
            res.push_back(vector<int>());
            preCol=cur.col;
          }
          res.back().push_back(cur.node->val);

        }
        return res;
    }
private:
    struct Triple
    {
        int row,col;
        TreeNode* node;
        Triple(TreeNode*node,int row,int col){
            this->node=node;
            this->row=row;
            this->col=col;
        }
    };
    vector<Triple> nodes;
    void dfs(TreeNode* root,int row,int col){
        if (root==nullptr) {
          return;
        }
        nodes.push_back(Triple(root,row,col));
        dfs(root->left,row+1,col-1);
        dfs(root->right,row+1,col+1);
    }
};
// @lc code=end



/*
// @lcpr case=start
// [3,9,20,null,null,15,7]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3,4,5,6,7]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3,4,6,5,7]\n
// @lcpr case=end

 */

