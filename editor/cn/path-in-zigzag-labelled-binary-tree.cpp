/*
 * @lc app=leetcode.cn id=1104 lang=cpp
 * @lcpr version=30202
 *
 * [1104] 二叉树寻路
 */

// @lc code=start
class Solution {
public:
    vector<int> pathInZigZagTree(int label) {
       vector<int> res;
       while (label>=1) {
         res.push_back(label);
         int depth=log2(label);
         vector<int> range=getRange(depth);
         label=range[1]-(label-range[0]);
         label/=2;
       } 
       reverse(res.begin(),res.end());
       return res;
    }
private:
    vector<int> getRange(int n){
        int p=pow(2,n);
        return {p,2*p-1};
    }
};
// @lc code=end



/*
// @lcpr case=start
// 14\n
// @lcpr case=end

// @lcpr case=start
// 26\n
// @lcpr case=end

 */

