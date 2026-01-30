/*
 * @lc app=leetcode.cn id=969 lang=rust
 * @lcpr version=30307
 *
 * [969] 煎饼排序
 */

// @lc code=start
use std::cmp::Ordering;
impl Solution {
    pub fn pancake_sort(mut arr: Vec<i32>) -> Vec<i32> {
        let n=arr.len();
        let mut res=vec![];
        for size in (1..=n).rev(){
            // 找到最大值的下标
            let mut max_index=(0..size).max_by(|&i,&j|{
                arr[i].cmp(&arr[j])
            }).unwrap();
            // 如果最大值已经在正确位置，跳过
            if max_index==size-1{
                continue;
            }
            // 如果最大值不在开头，先翻转到开头
            if max_index!=0{
                Self::reverse(&mut arr,max_index);
                res.push(max_index as i32+1);
            }
            // 再翻转到正确位置
            Self::reverse(&mut arr,size-1);
            res.push(size as i32);
        }
        res
    }
    /// 翻转数组前k个元素
    /// arr: 数组
    /// k: 下标
    /// 返回值: 无
    fn reverse(arr:&mut Vec<i32>,k:usize){
        let mut left=0;
        let mut right=k;
        while left<right{
            arr.swap(left,right);
            left+=1;
            right-=1;
        }
    }
}
// @lc code=end



/*
// @lcpr case=start
// [3,2,4,1]\n
// @lcpr case=end

// @lcpr case=start
// [1,2,3]\n
// @lcpr case=end

 */

