// Topic-based training groups ("专项"). Each group is a curated OR-set of
// LeetCode topic slugs: a problem belongs to the group when it carries any of
// the slugs.
export interface TrainingTopic {
  id: string
  name: string
  slugs: string[]
}

export const TRAINING_TOPICS: TrainingTopic[] = [
  { id: 'array-hash', name: '数组与哈希', slugs: ['array', 'hash-table'] },
  { id: 'two-pointers-window', name: '双指针与滑动窗口', slugs: ['two-pointers', 'sliding-window'] },
  { id: 'linked-list', name: '链表', slugs: ['linked-list'] },
  { id: 'stack-queue', name: '栈与队列', slugs: ['stack', 'monotonic-stack', 'queue'] },
  { id: 'binary-tree', name: '二叉树', slugs: ['binary-tree', 'binary-search-tree'] },
  { id: 'heap', name: '堆与 Top K', slugs: ['heap-priority-queue'] },
  {
    id: 'graph',
    name: '图论',
    slugs: [
      'graph', 'depth-first-search', 'breadth-first-search', 'union-find',
      'topological-sort', 'shortest-path', 'minimum-spanning-tree',
    ],
  },
  { id: 'binary-search', name: '二分查找', slugs: ['binary-search'] },
  { id: 'backtracking', name: '回溯', slugs: ['backtracking'] },
  { id: 'greedy', name: '贪心', slugs: ['greedy'] },
  { id: 'dynamic-programming', name: '动态规划', slugs: ['dynamic-programming', 'memoization'] },
  { id: 'prefix-sum', name: '前缀和', slugs: ['prefix-sum'] },
  { id: 'string', name: '字符串', slugs: ['string'] },
  { id: 'bit-manipulation', name: '位运算', slugs: ['bit-manipulation'] },
  { id: 'math', name: '数学', slugs: ['math'] },
  { id: 'design', name: '设计题', slugs: ['design'] },
]

/** AcWing 专项：每个专项映射到一个算法标签，走站点的标签搜索。 */
export const ACWING_TOPICS: Array<{ id: string; name: string; tag: string }> = [
  { id: 'simulation', name: '模拟', tag: '模拟' },
  { id: 'enumeration', name: '枚举', tag: '枚举' },
  { id: 'sorting', name: '排序', tag: '排序' },
  { id: 'binary-search', name: '二分', tag: '二分' },
  { id: 'greedy', name: '贪心', tag: '贪心' },
  { id: 'dp', name: '动态规划', tag: '动态规划' },
  { id: 'knapsack', name: '背包问题', tag: '背包问题' },
  { id: 'search', name: '搜索', tag: '搜索' },
  { id: 'graph', name: '图论', tag: '图论' },
  { id: 'shortest-path', name: '最短路', tag: '最短路' },
  { id: 'union-find', name: '并查集', tag: '并查集' },
  { id: 'string', name: '字符串', tag: '字符串' },
  { id: 'data-structures', name: '数据结构', tag: '数据结构' },
  { id: 'math', name: '数学', tag: '数学' },
  { id: 'number-theory', name: '数论', tag: '数论' },
  { id: 'geometry', name: '计算几何', tag: '计算几何' },
  { id: 'game', name: '博弈论', tag: '博弈论' },
]

export function findAcWingTopic(id: string) {
  return ACWING_TOPICS.find(topic => topic.id === id)
}

export function findTrainingTopic(id: string): TrainingTopic | undefined {
  return TRAINING_TOPICS.find(topic => topic.id === id)
}
