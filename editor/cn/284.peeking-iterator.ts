/*
 * @lc app=leetcode.cn id=284 lang=typescript
 * @lcpr version=30301
 *
 * [284] 窥视迭代器
 */

// @lc code=start
/**
 * // This is the Iterator's API interface.
 * // You should not implement it, or speculate about its implementation
 * class Iterator {
 *      hasNext(): boolean {}
 *
 *      next(): number {}
 * }
 */

class PeekingIterator {
  private iterator: Iterator;
  private cachedValue: number | undefined;

  constructor(iterator: Iterator) {
    this.iterator = iterator;
    this.cachedValue = undefined;
  }

  peek(): number {
    if (this.cachedValue === undefined) {
      this.cachedValue = this.iterator.next();
    }
    return this.cachedValue;
  }

  next(): number {
    if (this.cachedValue !== undefined) {
      const res = this.cachedValue;
      this.cachedValue = undefined;
      return res;
    }
    return this.iterator.next();
  }

  hasNext(): boolean {
    return this.cachedValue !== undefined || this.iterator.hasNext();
  }
}

/**
 * Your PeekingIterator object will be instantiated and called as such:
 * var obj = new PeekingIterator(iterator)
 * var param_1 = obj.peek()
 * var param_2 = obj.next()
 * var param_3 = obj.hasNext()
 */
// @lc code=end

/*
// @lcpr case=start
// ["PeekingIterator", "next", "peek", "next", "next", "hasNext"]\n[[[1, 2, 3]], [], [], [], [], []]\n
// @lcpr case=end

 */
