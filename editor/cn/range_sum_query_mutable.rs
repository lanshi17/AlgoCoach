/*
 * @lc app=leetcode.cn id=307 lang=rust
 * @lcpr version=30300
 *
 * [307] 区域和检索 - 数组可修改
 */

// @lc code=start
struct NumArray {
    tree:Vec<i32>,
    nums:Vec<i32>,
}


/** 
 * `&self` means the method takes an immutable reference.
 * If you need a mutable reference, change it to `&mut self` instead.
 */
impl NumArray {

    fn new(nums: Vec<i32>) -> Self {
       let n=nums.len();
       let mut num_array=Self{
        tree:vec![0;n+1],
        nums,
       };
       for i in 0..n{
        num_array.add(i+1,num_array.nums[i]);
       }
       num_array
    }
    fn add(&mut self,mut i:usize,delta:i32){
        while i<self.tree.len(){
            self.tree[i]+=delta;
            i+=i&i.wrapping_neg();
        }
    }
    fn prefix_sum(&self,mut i:usize)->i32{
        let mut sum=0;
        while i>0{
            sum+=self.tree[i];
            i-=i&i.wrapping_neg();
        }
        sum
    }
    fn update(&mut self, index: i32, val: i32) {
        let idx=index as usize;
        let delta=val-self.nums[idx];
        self.nums[idx]=val;
        self.add(idx+1,delta);
    }
    
    fn sum_range(&self, left: i32, right: i32) -> i32 {
        self.prefix_sum((right+1) as usize)-self.prefix_sum(left as usize)
    }
}

/**
 * Your NumArray object will be instantiated and called as such:
 * let obj = NumArray::new(nums);
 * obj.update(index, val);
 * let ret_2: i32 = obj.sum_range(left, right);
 */
// @lc code=end



/*
// @lcpr case=start
// ["NumArray", "sumRange", "update", "sumRange"]\n[[[1, 3, 5]], [0, 2], [1, 2], [0, 2]]\n
// @lcpr case=end

 */

