/*
 * @lc app=leetcode.cn id=1367 lang=cpp
 * @lcpr version=30203
 *
 * [1367] 二叉树中的链表
 */

// @lc code=start
/**
 * Definition for singly-linked list.
 * struct ListNode {
 *     int val;
 *     ListNode *next;
 *     ListNode() : val(0), next(nullptr) {}
 *     ListNode(int x) : val(x), next(nullptr) {}
 *     ListNode(int x, ListNode *next) : val(x), next(next) {}
 * };
 */
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
    bool isSubPath(ListNode* head, TreeNode* root) {
       if (head==nullptr) {
         return true;
       }
       if (root==nullptr) {
         return false;
       } 
       if (head->val==root->val) {
         if (isSame(head,root)) {
           return true;
         }
       }
       return isSubPath(head,root->left)||isSubPath(head,root->right);
    }
private:
    bool isSame(ListNode* head,TreeNode* root){
        if (head==nullptr) {
          return true;
        }
        if (root==nullptr) {
          return false;
        }
       if (root->val==head->val) {
         return isSame(head->next,root->left)||isSame(head->next,root->right);
       } 
       return false;
    }
};
// @lc code=end



/*
// @lcpr case=start
// [4,2,8]\n[1,4,4,null,2,2,null,1,null,6,8,null,null,null,null,1,3]\n
// @lcpr case=end

// @lcpr case=start
// [1,4,2,6]\n[1,4,4,null,2,2,null,1,null,6,8,null,null,null,null,1,3]\n
// @lcpr case=end

// @lcpr case=start
// [1,4,2,6,8]\n[1,4,4,null,2,2,null,1,null,6,8,null,null,null,null,1,3]\n
// @lcpr case=end

 */

