/*
 * @lc app=leetcode.cn id=138 lang=cpp
 * @lcpr version=30300
 *
 * [138] 随机链表的复制
 */

// @lc code=start
/*
// Definition for a Node.
class Node {
public:
    int val;
    Node* next;
    Node* random;
    
    Node(int _val) {
        val = _val;
        next = NULL;
        random = NULL;
    }
};
*/

class Solution {
public:
    Node* copyRandomList(Node* head) {
       unordered_map<Node*,Node*> origin_to_clone;
       for(Node* p=head;p!=nullptr;p=p->next){
            if (origin_to_clone.find(p)==origin_to_clone.end()) {
              origin_to_clone[p]=new Node(p->val);
            }
       }
       for(Node* p=head;p!=nullptr;p=p->next){
        if (p->next!=nullptr) {
          origin_to_clone[p]->next=origin_to_clone[p->next];
        }
        if (p->random!=nullptr) {
          origin_to_clone[p]->random=origin_to_clone[p->random];
        }
       }
       return origin_to_clone[head];
    }
};
// @lc code=end



/*
// @lcpr case=start
// [[7,null],[13,0],[11,4],[10,2],[1,0]]\n
// @lcpr case=end

// @lcpr case=start
// [[1,1],[2,1]]\n
// @lcpr case=end

// @lcpr case=start
// [[3,null],[3,0],[3,null]]\n
// @lcpr case=end

 */

