/*
 * @lc app=leetcode.cn id=315 lang=rust
 * @lcpr version=30203
 *
 * [315] 计算右侧小于当前元素的个数
 */

// @lc code=start
impl Solution {
    pub fn count_smaller(nums: Vec<i32>) -> Vec<i32> {
       let n=nums.len();
       let mut indices:Vec<usize>=(0..n).collect();
       let mut res:Vec<i32>=vec![0;n];
       Self::merge_sort(&nums,&mut indices,0,n,&mut res);
       res 
    }
    fn merge_sort(
        nums:&Vec<i32>,
        indices:&mut Vec<usize>,
        left:usize,
        right:usize,
        res:&mut Vec<i32>,
    ){
        if right-left<=1{
            return;
        }
        let mid=left+(right-left)/2;
        Self::merge_sort(nums,indices,left,mid,res);
        Self::merge_sort(nums,indices,mid,right,res);
        Self::merge(nums,indices,left,right,mid,res);
    }
    fn merge(
        nums:&Vec<i32>,
        indices:&mut Vec<usize>,
        left:usize,
        right:usize,
        mid:usize,
        res:&mut Vec<i32>,
    ){
        let mut tmp_indices:Vec<usize>=vec![0;right-left];
        let mut i=left;
        let mut j=mid;
        let mut k=0;
        let mut right_count=0;
        while i<mid&&j<right{
            if nums[indices[i]]>nums[indices[j]]{
                tmp_indices[k]=indices[j];
                right_count+=1;
                j+=1;
            }else{
                tmp_indices[k]=indices[i];
                res[indices[i]]+=right_count;
                i+=1;
            }
            k+=1;
        }
        while i<mid{
            tmp_indices[k]=indices[i];
            res[indices[i]]+=right_count;
            i+=1;
            k+=1;   
        }
        while j<right{
            tmp_indices[k]=indices[j];
            j+=1;
            k+=1;
        }
        for (index,&val) in tmp_indices.iter().enumerate(){
            indices[left+index]=val;
        }
    }
}
// @lc code=end



/*
// @lcpr case=start
// [5,2,6,1]\n
// @lcpr case=end

// @lcpr case=start
// [-1]\n
// @lcpr case=end

// @lcpr case=start
// [-1,-1]\n
// @lcpr case=end

 */

