/*
 * @lc app=leetcode.cn id=341 lang=rust
 * @lcpr version=30203
 *
 * [341] 扁平化嵌套列表迭代器
 */

// @lc code=start
// #[derive(Debug, PartialEq, Eq)]
// pub enum NestedInteger {
//   Int(i32),
//   List(Vec<NestedInteger>)
// }

impl NestedInteger {
    // 判断是否为整数
    pub fn is_integer(&self) -> bool {
        matches!(self, NestedInteger::Int(_))
    }
    
    // 获取整数值（仅当是整数时有效）
    pub fn get_integer(&self) -> i32 {
        match self {
            NestedInteger::Int(value) => *value,
            NestedInteger::List(_) => panic!("Not an integer"),
        }
    }
    
    // 获取列表（仅当是列表时有效）
    pub fn get_list(&self) -> &Vec<NestedInteger> {
        match self {
            NestedInteger::Int(_) => panic!("Not a list"),
            NestedInteger::List(list) => list,
        }
    }
}

// 扁平化迭代器实现
pub struct NestedIterator {
    // 使用栈来存储待处理的元素
    stack: Vec<NestedInteger>,
}

impl NestedIterator {
    /// 用嵌套列表初始化迭代器
    pub fn new(nested_list: Vec<NestedInteger>) -> Self {
        let mut iterator = NestedIterator {
            stack: Vec::new(),
        };
        
        // 将所有元素逆序压入栈中，这样可以保证按顺序处理
        for item in nested_list.into_iter().rev() {
            iterator.stack.push(item);
        }
        
        iterator
    }
    
    /// 返回下一个整数
    pub fn next(&mut self) -> i32 {
        // 根据hasNext的保证，栈顶一定是一个整数
        match self.stack.pop() {
            Some(NestedInteger::Int(value)) => value,
            _ => panic!("No next integer available"),
        }
    }
    
    /// 检查是否还有待迭代的整数
    pub fn has_next(&mut self) -> bool {
        // 循环处理直到栈为空或栈顶是整数
        while let Some(top) = self.stack.last() {
            if top.is_integer() {
                // 栈顶是整数，可以直接返回
                return true;
            }
            
            // 栈顶是列表，需要将其展开
            if let NestedInteger::List(list) = self.stack.pop().unwrap() {
                // 将列表中的元素逆序压入栈中
                for item in list.into_iter().rev() {
                    self.stack.push(item);
                }
            }
        }
        
        // 栈为空，没有更多元素
        false
    }
}

/**
 * Your NestedIterator object will be instantiated and called as such:
 * let obj = NestedIterator::new(nestedList);
 * let ret_1: i32 = obj.next();
 * let ret_2: bool = obj.has_next();
 */
// @lc code=end



/*
// @lcpr case=start
// [[1,1],2,[1,1]]\n
// @lcpr case=end

// @lcpr case=start
// [1,[4,[6]]]\n
// @lcpr case=end

 */

