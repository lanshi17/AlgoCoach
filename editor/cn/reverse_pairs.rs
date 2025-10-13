/*
 * @lc app=leetcode.cn id=493 lang=rust
 * @lcpr version=30203
 *
 * [493] 翻转对
 */

// @lc code=start
impl Solution {
    pub fn reverse_pairs(nums: Vec<i32>) -> i32 {
       if nums.is_empty(){
        return 0;
       } 
       let mut nums_clone=nums.clone();
       Self::merge_sort_count(&mut nums_clone,0,nums.len() as i32 -1)
    }
    fn merge_sort_count(
        nums:&mut Vec<i32>,
        left:i32,
        right:i32,
    )->i32{
        if left>=right{
            return 0;
        }
        let mid=left+(right-left)/2;
        let mut count=0;
        count+=Self::merge_sort_count(nums,left,mid);
        count+=Self::merge_sort_count(nums,mid+1,right);
        count+=Self::cout_pairs_during_merge(nums,left,mid,right);
        Self::merge(nums,left,mid,right);
        count
    }
    fn cout_pairs_during_merge(
        nums:&Vec<i32>,
        left:i32,
        mid:i32,
        right:i32,
    )->i32{
        let mut count=0;
        let mut i=left;
        let mut j=mid+1;
        while j<=right{
            while i<=mid&&nums[i as usize]as i64 <=2i64*nums[j as usize]as i64{
                i+=1;
            }
            if i<=mid{
                count+=mid-i+1;
            }
            j+=1;
        }
        count as i32
    }
    fn merge(
        nums:&mut Vec<i32>,
        left:i32,
        mid:i32,
        right:i32,
    ){
        let left_slice=nums[left as usize..(mid+1)as usize].to_vec();
        let right_slice=nums[(mid+1)as usize..(right+1)as usize].to_vec();

        let mut i=0;
        let mut j=0;
        let mut k=left as usize;
        while i<left_slice.len()&&j<right_slice.len(){
            if left_slice[i]<=right_slice[j]{
                nums[k]=left_slice[i];
                i+=1;
            }else{
                nums[k]=right_slice[j];
                j+=1;
            }
            k+=1;
        }
        while i<left_slice.len(){
            nums[k]=left_slice[i];
            i+=1;
            k+=1;
        }
        while j<right_slice.len(){
            nums[k]=right_slice[j];
            j+=1;
            k+=1;
        }
        
    }
}
// @lc code=end



/*
// @lcpr case=start
// [1,3,2,3,1]\n
// @lcpr case=end

// @lcpr case=start
// [2,4,3,5,1]\n
// @lcpr case=end

 */

