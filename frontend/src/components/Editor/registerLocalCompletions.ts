import * as monaco from 'monaco-editor/editor'

type LocalCompletion = {
  label: string
  insertText?: string
  detail: string
  kind?: monaco.languages.CompletionItemKind
  snippet?: boolean
}

const COMPLETIONS: Record<string, LocalCompletion[]> = {
  python: [
    { label: 'def', insertText: 'def ${1:name}(${2:args}):\n    ${3:pass}', detail: '函数定义', snippet: true },
    { label: 'for', insertText: 'for ${1:item} in ${2:items}:\n    ${3:pass}', detail: 'for 循环', snippet: true },
    { label: 'enumerate', insertText: 'enumerate(${1:items})', detail: '遍历下标与元素' },
    { label: 'range', insertText: 'range(${1:n})', detail: '整数范围' },
    { label: 'deque', insertText: 'deque()', detail: '双端队列（collections）' },
    { label: 'defaultdict', insertText: 'defaultdict(${1:list})', detail: '带默认值的字典（collections）' },
    { label: 'heapq', insertText: 'heapq.heappush(${1:heap}, ${2:value})', detail: '堆操作' },
    { label: 'sorted', insertText: 'sorted(${1:items}, key=${2:key})', detail: '排序并返回新列表' },
    { label: 'set', insertText: 'set()', detail: '集合' },
    { label: 'dict', insertText: 'dict()', detail: '字典' },
  ],
  cpp: [
    { label: 'vector', insertText: 'vector<${1:int}> ${2:values};', detail: '动态数组', snippet: true },
    { label: 'unordered_map', insertText: 'unordered_map<${1:int}, ${2:int}> ${3:indices};', detail: '哈希表', snippet: true },
    { label: 'unordered_set', insertText: 'unordered_set<${1:int}> ${2:seen};', detail: '哈希集合', snippet: true },
    { label: 'priority_queue', insertText: 'priority_queue<${1:int}> ${2:heap};', detail: '优先队列', snippet: true },
    { label: 'sort', insertText: 'sort(${1:values}.begin(), ${1:values}.end());', detail: '排序' },
    { label: 'lower_bound', insertText: 'lower_bound(${1:values}.begin(), ${1:values}.end(), ${2:target})', detail: '二分查找下界' },
    { label: 'for', insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n    ${3:}\n}', detail: '计数循环', snippet: true },
    { label: 'while', insertText: 'while (${1:condition}) {\n    ${2:}\n}', detail: 'while 循环', snippet: true },
  ],
  rust: [
    { label: 'let mut', insertText: 'let mut ${1:value} = ${2:Vec::new()};', detail: '可变变量', snippet: true },
    { label: 'Vec::new', insertText: 'Vec::new()', detail: '创建动态数组' },
    { label: 'HashMap::new', insertText: 'HashMap::new()', detail: '创建哈希表' },
    { label: 'HashSet::new', insertText: 'HashSet::new()', detail: '创建哈希集合' },
    { label: 'for', insertText: 'for ${1:item} in ${2:items} {\n    ${3:}\n}', detail: 'for 循环', snippet: true },
    { label: 'while', insertText: 'while ${1:condition} {\n    ${2:}\n}', detail: 'while 循环', snippet: true },
    { label: 'iter', insertText: 'iter()', detail: '不可变迭代器' },
    { label: 'enumerate', insertText: 'enumerate()', detail: '带下标迭代' },
  ],
  typescript: [
    { label: 'const', insertText: 'const ${1:name} = ${2:value};', detail: '常量声明', snippet: true },
    { label: 'let', insertText: 'let ${1:name} = ${2:value};', detail: '变量声明', snippet: true },
    { label: 'function', insertText: 'function ${1:name}(${2:args}) {\n  ${3:}\n}', detail: '函数定义', snippet: true },
    { label: 'Map', insertText: 'new Map<${1:string}, ${2:number}>()', detail: '键值映射' },
    { label: 'Set', insertText: 'new Set<${1:number}>()', detail: '唯一值集合' },
    { label: 'Array.from', insertText: 'Array.from(${1:items}, (${2:item}, ${3:index}) => ${4:item})', detail: '从可迭代对象创建数组' },
    { label: 'for', insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n  ${3:}\n}', detail: '计数循环', snippet: true },
  ],
  go: [
    { label: 'func', insertText: 'func ${1:name}(${2:args}) ${3:error} {\n\t${4:}\n}', detail: '函数定义', snippet: true },
    { label: 'for', insertText: 'for ${1:i} := 0; ${1:i} < ${2:n}; ${1:i}++ {\n\t${3:}\n}', detail: '计数循环', snippet: true },
    { label: 'range', insertText: 'range ${1:items}', detail: '遍历切片、映射或通道' },
    { label: 'make', insertText: 'make(map[${1:int}]${2:int})', detail: '创建映射' },
    { label: 'append', insertText: 'append(${1:items}, ${2:value})', detail: '追加切片元素' },
    { label: 'map', insertText: 'map[${1:int}]${2:int}', detail: '映射类型', snippet: true },
    { label: 'if err', insertText: 'if err != nil {\n\treturn ${1:err}\n}', detail: '错误检查', snippet: true },
  ],
  java: [
    { label: 'for', insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3:}\n}', detail: '计数循环', snippet: true },
    { label: 'for each', insertText: 'for (${1:int} ${2:item} : ${3:items}) {\n    ${4:}\n}', detail: '增强 for 循环', snippet: true },
    { label: 'HashMap', insertText: 'Map<${1:Integer}, ${2:Integer}> ${3:map} = new HashMap<>();', detail: '哈希表', snippet: true },
    { label: 'HashSet', insertText: 'Set<${1:Integer}> ${2:seen} = new HashSet<>();', detail: '哈希集合', snippet: true },
    { label: 'ArrayDeque', insertText: 'Deque<${1:Integer}> ${2:queue} = new ArrayDeque<>();', detail: '双端队列', snippet: true },
    { label: 'PriorityQueue', insertText: 'PriorityQueue<${1:Integer}> ${2:heap} = new PriorityQueue<>();', detail: '优先队列', snippet: true },
    { label: 'Arrays.sort', insertText: 'Arrays.sort(${1:values});', detail: '数组排序' },
  ],
}

const providerDisposables = Object.entries(COMPLETIONS).map(([language, items]) =>
  monaco.languages.registerCompletionItemProvider(language, {
    triggerCharacters: ['.'],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position)
      const prefix = word.word.toLowerCase()
      const range = new monaco.Range(
        position.lineNumber,
        word.startColumn,
        position.lineNumber,
        word.endColumn,
      )
      return {
        suggestions: items
          .filter(item => !prefix || item.label.toLowerCase().startsWith(prefix))
          .map(item => ({
            label: item.label,
            detail: item.detail,
            kind: item.kind ?? monaco.languages.CompletionItemKind.Keyword,
            insertText: item.insertText ?? item.label,
            insertTextRules: item.snippet
              ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
              : undefined,
            range,
          })),
      }
    },
  }),
)

// Keep registrations alive for the editor module's lifetime. Referencing the
// disposables also makes this intentional singleton setup clear to bundlers.
void providerDisposables
