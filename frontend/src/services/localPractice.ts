import type { CodeLanguage, Problem } from '@/types'

/**
 * A small offline shelf for the desktop client. It keeps the first practice
 * loop useful before a platform cookie or the Java gateway is configured.
 * These are deliberately plain, old-school exercises: read the statement,
 * write the loop yourself, then keep the draft in the local notebook.
 */
export const LOCAL_PRACTICE_PROBLEMS: Problem[] = [
  {
    id: 'local-two-sum',
    platform: 'LEETCODE',
    platformId: 'local-two-sum',
    title: 'Two Sum · notebook edition',
    titleCn: '两数之和 · 纸上练习',
    difficulty: 'EASY',
    topics: ['数组', '哈希表'],
    contentHtml: `
      <p>给定一个整数数组 <code>nums</code> 和一个整数 <code>target</code>，请找出和为 <code>target</code> 的两个下标。</p>
      <p>每种输入只会对应一个答案，同一个元素不能使用两次。先写出最直接的双重循环，再思考如何把查找变成常数时间。</p>
      <h3>约束</h3>
      <ul><li><code>2 ≤ nums.length ≤ 10⁴</code></li><li><code>-10⁹ ≤ nums[i], target ≤ 10⁹</code></li></ul>
      <h3>样例</h3>
      <pre>nums = [2, 7, 11, 15]\ntarget = 9</pre>
      <p>返回 <code>[0, 1]</code>。先保证正确，再记录复杂度。</p>
    `,
    sampleTestCases: '2 7 11 15\n9',
    codeSnippets: buildSnippets({
      rust: 'fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {\n    todo!()\n}',
      cpp: '#include <vector>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    // 请在这里编写解法\n}',
      python3: 'def two_sum(nums: list[int], target: int):\n    pass',
      typescript: 'function twoSum(nums: number[], target: number) {\n  throw new Error("尚未实现");\n}',
      golang: 'func twoSum(nums []int, target int) []int {\n    panic("尚未实现")\n}',
      java: 'class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        throw new UnsupportedOperationException();\n    }\n}',
    }),
  },
  {
    id: 'local-binary-search',
    platform: 'LEETCODE',
    platformId: 'local-binary-search',
    title: 'Binary Search · notebook edition',
    titleCn: '二分查找 · 纸上练习',
    difficulty: 'EASY',
    topics: ['数组', '二分'],
    contentHtml: `
      <p>在升序数组 <code>nums</code> 中找到 <code>target</code> 的下标。找不到时返回 <code>-1</code>。</p>
      <p>把每一次比较写在纸上：区间的左右边界是什么？哪一半一定可以丢掉？</p>
      <h3>样例</h3><pre>nums = [-1, 0, 3, 5, 9, 12]\ntarget = 9</pre>
      <p>返回 <code>4</code>，要求时间复杂度为 <code>O(log n)</code>。</p>
    `,
    sampleTestCases: '-1 0 3 5 9 12\n9',
    codeSnippets: buildSnippets({
      rust: 'fn search(nums: Vec<i32>, target: i32) -> i32 {\n    todo!()\n}',
      cpp: '#include <vector>\nusing namespace std;\n\nint search(vector<int>& nums, int target) {\n    // 请在这里编写解法\n}',
      python3: 'def search(nums: list[int], target: int):\n    pass',
      typescript: 'function search(nums: number[], target: number) {\n  throw new Error("尚未实现");\n}',
      golang: 'func search(nums []int, target int) int {\n    panic("尚未实现")\n}',
      java: 'class Solution {\n    public int search(int[] nums, int target) {\n        throw new UnsupportedOperationException();\n    }\n}',
    }),
  },
]

function buildSnippets(snippets: Partial<Record<CodeLanguage, string>>) {
  return Object.entries(snippets).map(([lang, code]) => ({ lang, code: code ?? '' }))
}

export function isLocalPracticeProblem(problem: Problem | null | undefined): boolean {
  return Boolean(problem?.id.startsWith('local-') || problem?.platformId.startsWith('local-'))
}
