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
    { label: 'return', detail: '返回函数结果' },
    { label: 'if', insertText: 'if ${1:condition}:\n    ${2:pass}', detail: '条件分支', snippet: true },
    { label: 'while', insertText: 'while ${1:condition}:\n    ${2:pass}', detail: 'while 循环', snippet: true },
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
    { label: 'return', detail: '返回函数结果' },
    { label: 'if', insertText: 'if (${1:condition}) {\n    ${2:}\n}', detail: '条件分支', snippet: true },
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
    { label: 'return', detail: '返回函数结果' },
    { label: 'if', insertText: 'if ${1:condition} {\n    ${2:}\n}', detail: '条件分支', snippet: true },
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
    { label: 'return', detail: '返回函数结果' },
    { label: 'if', insertText: 'if (${1:condition}) {\n  ${2:}\n}', detail: '条件分支', snippet: true },
    { label: 'let', insertText: 'let ${1:name} = ${2:value};', detail: '变量声明', snippet: true },
    { label: 'function', insertText: 'function ${1:name}(${2:args}) {\n  ${3:}\n}', detail: '函数定义', snippet: true },
    { label: 'Map', insertText: 'new Map<${1:string}, ${2:number}>()', detail: '键值映射' },
    { label: 'Set', insertText: 'new Set<${1:number}>()', detail: '唯一值集合' },
    { label: 'Array.from', insertText: 'Array.from(${1:items}, (${2:item}, ${3:index}) => ${4:item})', detail: '从可迭代对象创建数组' },
    { label: 'for', insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n  ${3:}\n}', detail: '计数循环', snippet: true },
  ],
  go: [
    { label: 'func', insertText: 'func ${1:name}(${2:args}) ${3:error} {\n\t${4:}\n}', detail: '函数定义', snippet: true },
    { label: 'return', detail: '返回函数结果' },
    { label: 'if', insertText: 'if ${1:condition} {\n\t${2:}\n}', detail: '条件分支', snippet: true },
    { label: 'for', insertText: 'for ${1:i} := 0; ${1:i} < ${2:n}; ${1:i}++ {\n\t${3:}\n}', detail: '计数循环', snippet: true },
    { label: 'range', insertText: 'range ${1:items}', detail: '遍历切片、映射或通道' },
    { label: 'make', insertText: 'make(map[${1:int}]${2:int})', detail: '创建映射' },
    { label: 'append', insertText: 'append(${1:items}, ${2:value})', detail: '追加切片元素' },
    { label: 'map', insertText: 'map[${1:int}]${2:int}', detail: '映射类型', snippet: true },
    { label: 'if err', insertText: 'if err != nil {\n\treturn ${1:err}\n}', detail: '错误检查', snippet: true },
  ],
  java: [
    { label: 'for', insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3:}\n}', detail: '计数循环', snippet: true },
    { label: 'return', detail: '返回函数结果' },
    { label: 'if', insertText: 'if (${1:condition}) {\n    ${2:}\n}', detail: '条件分支', snippet: true },
    { label: 'for each', insertText: 'for (${1:int} ${2:item} : ${3:items}) {\n    ${4:}\n}', detail: '增强 for 循环', snippet: true },
    { label: 'HashMap', insertText: 'Map<${1:Integer}, ${2:Integer}> ${3:map} = new HashMap<>();', detail: '哈希表', snippet: true },
    { label: 'HashSet', insertText: 'Set<${1:Integer}> ${2:seen} = new HashSet<>();', detail: '哈希集合', snippet: true },
    { label: 'ArrayDeque', insertText: 'Deque<${1:Integer}> ${2:queue} = new ArrayDeque<>();', detail: '双端队列', snippet: true },
    { label: 'PriorityQueue', insertText: 'PriorityQueue<${1:Integer}> ${2:heap} = new PriorityQueue<>();', detail: '优先队列', snippet: true },
    { label: 'Arrays.sort', insertText: 'Arrays.sort(${1:values});', detail: '数组排序' },
  ],
}

const CPP_MEMBER_COMPLETIONS: Record<string, LocalCompletion[]> = {
  vector: [
    { label: 'size', detail: '元素个数' },
    { label: 'empty', detail: '是否为空' },
    { label: 'push_back', insertText: 'push_back(${1:value})', detail: '尾部追加元素' },
    { label: 'emplace_back', insertText: 'emplace_back(${1:args})', detail: '尾部原位构造' },
    { label: 'pop_back', insertText: 'pop_back()', detail: '删除尾部元素' },
    { label: 'front', insertText: 'front()', detail: '首元素' },
    { label: 'back', insertText: 'back()', detail: '尾元素' },
    { label: 'begin', insertText: 'begin()', detail: '起始迭代器' },
    { label: 'end', insertText: 'end()', detail: '尾后迭代器' },
    { label: 'rbegin', insertText: 'rbegin()', detail: '反向起始迭代器' },
    { label: 'rend', insertText: 'rend()', detail: '反向尾后迭代器' },
    { label: 'resize', insertText: 'resize(${1:size})', detail: '调整大小' },
    { label: 'reserve', insertText: 'reserve(${1:capacity})', detail: '预留容量' },
    { label: 'clear', insertText: 'clear()', detail: '清空容器' },
    { label: 'insert', insertText: 'insert(${1:position}, ${2:value})', detail: '插入元素' },
    { label: 'erase', insertText: 'erase(${1:position})', detail: '删除元素' },
  ],
  string: [
    { label: 'size', detail: '字符串长度' }, { label: 'length', detail: '字符串长度' },
    { label: 'empty', detail: '是否为空' }, { label: 'substr', insertText: 'substr(${1:pos}, ${2:count})', detail: '截取子串' },
    { label: 'find', insertText: 'find(${1:target})', detail: '查找子串' }, { label: 'rfind', insertText: 'rfind(${1:target})', detail: '反向查找子串' },
    { label: 'push_back', insertText: 'push_back(${1:ch})', detail: '追加字符' }, { label: 'pop_back', insertText: 'pop_back()', detail: '删除尾字符' },
    { label: 'front', insertText: 'front()', detail: '首字符' }, { label: 'back', insertText: 'back()', detail: '尾字符' },
    { label: 'begin', insertText: 'begin()', detail: '起始迭代器' }, { label: 'end', insertText: 'end()', detail: '尾后迭代器' },
    { label: 'clear', insertText: 'clear()', detail: '清空字符串' },
  ],
  map: [
    { label: 'find', insertText: 'find(${1:key})', detail: '查找键' }, { label: 'count', insertText: 'count(${1:key})', detail: '统计键是否存在' },
    { label: 'contains', insertText: 'contains(${1:key})', detail: '判断键是否存在（C++20）' }, { label: 'at', insertText: 'at(${1:key})', detail: '访问键对应值' },
    { label: 'operator[]', insertText: '[${1:key}]', detail: '下标访问或插入' }, { label: 'insert', insertText: 'insert({${1:key}, ${2:value}})', detail: '插入键值对' },
    { label: 'emplace', insertText: 'emplace(${1:key}, ${2:value})', detail: '原位插入键值对' }, { label: 'erase', insertText: 'erase(${1:key})', detail: '删除键' },
    { label: 'size', detail: '元素个数' }, { label: 'empty', detail: '是否为空' }, { label: 'clear', insertText: 'clear()', detail: '清空容器' },
    { label: 'begin', insertText: 'begin()', detail: '起始迭代器' }, { label: 'end', insertText: 'end()', detail: '尾后迭代器' },
  ],
  unordered_map: [],
  set: [
    { label: 'insert', insertText: 'insert(${1:value})', detail: '插入元素' }, { label: 'emplace', insertText: 'emplace(${1:value})', detail: '原位插入' },
    { label: 'find', insertText: 'find(${1:value})', detail: '查找元素' }, { label: 'count', insertText: 'count(${1:value})', detail: '统计元素是否存在' },
    { label: 'contains', insertText: 'contains(${1:value})', detail: '判断元素是否存在（C++20）' }, { label: 'lower_bound', insertText: 'lower_bound(${1:value})', detail: '第一个不小于 value 的元素' },
    { label: 'upper_bound', insertText: 'upper_bound(${1:value})', detail: '第一个大于 value 的元素' }, { label: 'erase', insertText: 'erase(${1:value})', detail: '删除元素' },
    { label: 'size', detail: '元素个数' }, { label: 'empty', detail: '是否为空' }, { label: 'clear', insertText: 'clear()', detail: '清空容器' },
    { label: 'begin', insertText: 'begin()', detail: '起始迭代器' }, { label: 'end', insertText: 'end()', detail: '尾后迭代器' },
  ],
  unordered_set: [],
  priority_queue: [
    { label: 'push', insertText: 'push(${1:value})', detail: '加入元素' }, { label: 'emplace', insertText: 'emplace(${1:value})', detail: '原位加入元素' },
    { label: 'pop', insertText: 'pop()', detail: '删除堆顶' }, { label: 'top', insertText: 'top()', detail: '读取堆顶' },
    { label: 'size', detail: '元素个数' }, { label: 'empty', detail: '是否为空' },
  ],
  deque: [
    { label: 'push_front', insertText: 'push_front(${1:value})', detail: '头部追加' }, { label: 'push_back', insertText: 'push_back(${1:value})', detail: '尾部追加' },
    { label: 'pop_front', insertText: 'pop_front()', detail: '删除首元素' }, { label: 'pop_back', insertText: 'pop_back()', detail: '删除尾元素' },
    { label: 'front', insertText: 'front()', detail: '首元素' }, { label: 'back', insertText: 'back()', detail: '尾元素' },
    { label: 'size', detail: '元素个数' }, { label: 'empty', detail: '是否为空' }, { label: 'clear', insertText: 'clear()', detail: '清空容器' },
  ],
  queue: [
    { label: 'push', insertText: 'push(${1:value})', detail: '加入队尾' }, { label: 'emplace', insertText: 'emplace(${1:value})', detail: '原位加入队尾' },
    { label: 'pop', insertText: 'pop()', detail: '删除队首' }, { label: 'front', insertText: 'front()', detail: '读取队首' }, { label: 'back', insertText: 'back()', detail: '读取队尾' },
    { label: 'size', detail: '元素个数' }, { label: 'empty', detail: '是否为空' },
  ],
  stack: [
    { label: 'push', insertText: 'push(${1:value})', detail: '压栈' }, { label: 'emplace', insertText: 'emplace(${1:value})', detail: '原位压栈' },
    { label: 'pop', insertText: 'pop()', detail: '弹栈' }, { label: 'top', insertText: 'top()', detail: '栈顶' }, { label: 'size', detail: '元素个数' }, { label: 'empty', detail: '是否为空' },
  ],
}
CPP_MEMBER_COMPLETIONS.unordered_map = CPP_MEMBER_COMPLETIONS.map
CPP_MEMBER_COMPLETIONS.unordered_set = CPP_MEMBER_COMPLETIONS.set

const CPP_NAMESPACE_COMPLETIONS: LocalCompletion[] = [
  { label: 'vector', insertText: 'vector<${1:int}>', detail: '动态数组类型', snippet: true },
  { label: 'string', insertText: 'string', detail: '字符串类型' }, { label: 'map', insertText: 'map<${1:key}, ${2:value}>', detail: '有序映射类型', snippet: true },
  { label: 'unordered_map', insertText: 'unordered_map<${1:key}, ${2:value}>', detail: '哈希映射类型', snippet: true },
  { label: 'set', insertText: 'set<${1:value}>', detail: '有序集合类型', snippet: true }, { label: 'unordered_set', insertText: 'unordered_set<${1:value}>', detail: '哈希集合类型', snippet: true },
  { label: 'queue', insertText: 'queue<${1:value}>', detail: '队列类型', snippet: true }, { label: 'deque', insertText: 'deque<${1:value}>', detail: '双端队列类型', snippet: true },
  { label: 'stack', insertText: 'stack<${1:value}>', detail: '栈类型', snippet: true }, { label: 'priority_queue', insertText: 'priority_queue<${1:value}>', detail: '优先队列类型', snippet: true },
  { label: 'sort', insertText: 'sort(${1:first}, ${2:last})', detail: '排序算法' }, { label: 'reverse', insertText: 'reverse(${1:first}, ${2:last})', detail: '反转区间' },
  { label: 'lower_bound', insertText: 'lower_bound(${1:first}, ${2:last}, ${3:value})', detail: '二分查找下界' }, { label: 'upper_bound', insertText: 'upper_bound(${1:first}, ${2:last}, ${3:value})', detail: '二分查找上界' },
  { label: 'min', insertText: 'min(${1:a}, ${2:b})', detail: '较小值' }, { label: 'max', insertText: 'max(${1:a}, ${2:b})', detail: '较大值' },
  { label: 'accumulate', insertText: 'accumulate(${1:first}, ${2:last}, ${3:init})', detail: '区间累加' }, { label: 'iota', insertText: 'iota(${1:first}, ${2:last}, ${3:value})', detail: '连续填充' },
]

const providerDisposables = Object.entries(COMPLETIONS).map(([language, items]) =>
  monaco.languages.registerCompletionItemProvider(language, {
    triggerCharacters: ['.'],
    provideCompletionItems(model, position, context) {
      const word = model.getWordUntilPosition(position)
      const prefix = word.word.toLowerCase()
      let candidates = items
      let completionRange = word
      let filterPrefix = prefix
      if (language === 'cpp') {
        const line = model.getLineContent?.(position.lineNumber) ?? ''
        const beforeCursor = line.slice(0, Math.max(0, position.column - 1))
        const memberMatch = beforeCursor.match(/(?:std::)?([A-Za-z_]\w*)\s*(?:\.|->)\s*([A-Za-z_]\w*)?$/)
        const namespaceMatch = beforeCursor.match(/(?:std::)?$/)
        if (memberMatch) {
          const base = memberMatch[1].toLowerCase()
          let containerType = base
          const document = model.getValue?.() ?? ''
          const declaration = document.match(
            new RegExp(`(?:std::)?(vector|string|map|unordered_map|set|unordered_set|deque|queue|stack|priority_queue)\\s*(?:<[^;\\n>]*(?:>[^;\\n]*)?>\\s*)?${base}\\b`),
          )
          if (declaration) containerType = declaration[1].toLowerCase()
          const members = CPP_MEMBER_COMPLETIONS[containerType]
          if (members) candidates = members
          completionRange = word
        } else if (namespaceMatch && (prefix.startsWith('std') || beforeCursor.endsWith('std::'))) {
          candidates = CPP_NAMESPACE_COMPLETIONS
          filterPrefix = beforeCursor.endsWith('std::') ? '' : prefix.replace(/^std::?/, '')
        } else if (!prefix && context?.triggerKind === monaco.languages.CompletionTriggerKind.TriggerCharacter) {
          return { suggestions: [] }
        }
      } else if (!prefix && context?.triggerKind === monaco.languages.CompletionTriggerKind.TriggerCharacter) {
        return { suggestions: [] }
      }
      const range = new monaco.Range(
        position.lineNumber,
        completionRange.startColumn,
        position.lineNumber,
        completionRange.endColumn,
      )
      return {
        suggestions: candidates
          .filter(item => !filterPrefix || item.label.toLowerCase().startsWith(filterPrefix))
          .map(item => {
            const insertText = item.insertText ?? item.label
            // Placeholders only expand when Monaco is told the text is a
            // snippet; otherwise the user gets the literal `${1:n}`.
            const isSnippet = item.snippet === true || /\$\{\d+[:}]/.test(insertText)
            return {
              label: item.label,
              detail: item.detail,
              kind: item.kind ?? monaco.languages.CompletionItemKind.Keyword,
              insertText,
              insertTextRules: isSnippet
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                : undefined,
              range,
            }
          }),
      }
    },
  }),
)

// Keep registrations alive for the editor module's lifetime. Referencing the
// disposables also makes this intentional singleton setup clear to bundlers.
void providerDisposables

const hot = (import.meta as ImportMeta & {
  hot?: { dispose(callback: () => void): void }
}).hot
// A Vite HMR replay evaluates this module again; without disposing the old
// providers every language would list each suggestion twice.
hot?.dispose(() => providerDisposables.forEach(provider => provider.dispose()))
