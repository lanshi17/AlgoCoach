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
      rust: `use std::collections::HashMap;\n\nfn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {\n    let mut seen = HashMap::new();\n    for (i, &value) in nums.iter().enumerate() {\n        let need = target - value;\n        if let Some(&j) = seen.get(&need) {\n            return vec![j, i as i32];\n        }\n        seen.insert(value, i as i32);\n    }\n    vec![]\n}`,
      cpp: `#include <vector>\n#include <unordered_map>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    unordered_map<int, int> seen;\n    for (int i = 0; i < (int)nums.size(); ++i) {\n        int need = target - nums[i];\n        if (seen.count(need)) return {seen[need], i};\n        seen[nums[i]] = i;\n    }\n    return {};\n}`,
      python3: `def two_sum(nums: list[int], target: int) -> list[int]:\n    seen: dict[int, int] = {}\n    for index, value in enumerate(nums):\n        need = target - value\n        if need in seen:\n            return [seen[need], index]\n        seen[value] = index\n    return []`,
      typescript: `function twoSum(nums: number[], target: number): number[] {\n  const seen = new Map<number, number>();\n  for (let i = 0; i < nums.length; i += 1) {\n    const need = target - nums[i];\n    if (seen.has(need)) return [seen.get(need)!, i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}`,
      golang: `func twoSum(nums []int, target int) []int {\n    seen := map[int]int{}\n    for i, value := range nums {\n        if j, ok := seen[target-value]; ok { return []int{j, i} }\n        seen[value] = i\n    }\n    return []int{}\n}`,
      java: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        Map<Integer, Integer> seen = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int need = target - nums[i];\n            if (seen.containsKey(need)) return new int[]{seen.get(need), i};\n            seen.put(nums[i], i);\n        }\n        return new int[0];\n    }\n}`,
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
      rust: `fn search(nums: Vec<i32>, target: i32) -> i32 {\n    let (mut left, mut right) = (0_i32, nums.len() as i32 - 1);\n    while left <= right {\n        let mid = left + (right - left) / 2;\n        if nums[mid as usize] == target { return mid; }\n        if nums[mid as usize] < target { left = mid + 1; }\n        else { right = mid - 1; }\n    }\n    -1\n}`,
      cpp: `int search(vector<int>& nums, int target) {\n    int left = 0, right = (int)nums.size() - 1;\n    while (left <= right) {\n        int mid = left + (right - left) / 2;\n        if (nums[mid] == target) return mid;\n        if (nums[mid] < target) left = mid + 1;\n        else right = mid - 1;\n    }\n    return -1;\n}`,
      python3: `def search(nums: list[int], target: int) -> int:\n    left, right = 0, len(nums) - 1\n    while left <= right:\n        mid = left + (right - left) // 2\n        if nums[mid] == target:\n            return mid\n        if nums[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1`,
      typescript: `function search(nums: number[], target: number): number {\n  let left = 0; let right = nums.length - 1;\n  while (left <= right) {\n    const mid = left + Math.floor((right - left) / 2);\n    if (nums[mid] === target) return mid;\n    if (nums[mid] < target) left = mid + 1; else right = mid - 1;\n  }\n  return -1;\n}`,
      golang: `func search(nums []int, target int) int {\n    left, right := 0, len(nums)-1\n    for left <= right {\n        mid := left + (right-left)/2\n        if nums[mid] == target { return mid }\n        if nums[mid] < target { left = mid + 1 } else { right = mid - 1 }\n    }\n    return -1\n}`,
      java: `class Solution {\n    public int search(int[] nums, int target) {\n        int left = 0, right = nums.length - 1;\n        while (left <= right) {\n            int mid = left + (right - left) / 2;\n            if (nums[mid] == target) return mid;\n            if (nums[mid] < target) left = mid + 1; else right = mid - 1;\n        }\n        return -1;\n    }\n}`,
    }),
  },
]

function buildSnippets(snippets: Partial<Record<CodeLanguage, string>>) {
  return Object.entries(snippets).map(([lang, code]) => ({ lang, code: code ?? '' }))
}

export function isLocalPracticeProblem(problem: Problem | null | undefined): boolean {
  return Boolean(problem?.id.startsWith('local-') || problem?.platformId.startsWith('local-'))
}
