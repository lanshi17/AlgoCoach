import json
import os
import re
import time
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

calls = []
valid_cookie = False
problem_detail_calls = 0
summary = [
    {"questionId": "1", "titleSlug": "two-sum", "title": "Two Sum", "difficulty": "EASY", "topicTags": [{"name": "Array"}]},
    {"questionId": "2", "titleSlug": "add-two-numbers", "title": "Add Two Numbers", "difficulty": "MEDIUM", "topicTags": [{"name": "Linked List"}]},
]

def respond(route, status=200, body=None):
    route.fulfill(status=status, content_type='application/json', body=json.dumps({} if body is None else body))

def mock_api(route):
    global valid_cookie, problem_detail_calls
    request = route.request
    url = urlparse(request.url)
    path = url.path
    if path.startswith('/api/'):
        calls.append((request.method, path, request.post_data or ''))
    if path == '/api/auth/status':
        respond(route, body={"authenticated": False})
    elif path == '/api/auth/cookie' and request.method == 'POST':
        respond(route, body={})
    elif path == '/api/auth/validate':
        valid_cookie = True
        respond(route, body={"authenticated": True})
    elif path == '/api/problems' and request.method == 'GET':
        query = parse_qs(url.query)
        page = int(query.get('page', ['1'])[0])
        respond(route, body={"total": 51, "questions": summary if page == 1 else [
            {"questionId": "3", "titleSlug": "climbing-stairs", "title": "Climbing Stairs", "difficulty": "EASY", "topicTags": [{"name": "Dynamic Programming"}]}
        ]})
    elif path == '/api/problems/two-sum':
        problem_detail_calls += 1
        if problem_detail_calls > 1:
            time.sleep(1.5)
        statement = 'Safe statement' if problem_detail_calls == 1 else 'Fresh statement after refresh'
        respond(route, body={
            "questionId": "1", "titleSlug": "two-sum", "title": "Two Sum", "translatedTitle": "两数之和",
            "difficulty": "EASY", "content": f"<p>{statement}</p><p>Limit: $0 \\le n \\le 10^5$</p><script>window.problemXss = true</script>",
            "topicTags": [{"name": "Array", "translatedName": "数组"}],
            "sampleTestCase": "2\n7 2\n9",
            "codeSnippets": [
                {"lang": "Rust", "langSlug": "rust", "code": "fn two_sum() {}"},
                {"lang": "Python3", "langSlug": "python3", "code": "def two_sum():\\n    pass"},
            ],
        })
    elif path == '/api/run':
        payload = json.loads(request.post_data or '{}')
        assert payload['titleSlug'] == 'two-sum'
        assert payload['lang'] == 'python3'
        assert payload['testInput'] == '2\n7 2\n9'
        respond(route, body={"state": "SUCCESS", "status_msg": "Accepted", "code_answer": ["[0, 1]"], "expected_code_answer": ["[0, 1]"], "total_correct": 1, "total_testcases": 1})
    elif path == '/api/submit':
        payload = json.loads(request.post_data or '{}')
        assert payload['titleSlug'] == 'two-sum'
        assert payload['lang'] == 'python3'
        assert isinstance(payload['durationSec'], int)
        respond(route, body={"id": "submission-1", "status": "ACCEPTED", "runtimeMs": 3, "memoryMb": 4, "passedTests": 73, "totalTests": 73, "errorMessage": None, "durationSec": payload['durationSec']})
    elif path == '/api/agent/memory/profile' and request.method == 'GET':
        respond(route, body={
            'topics': [
                {'topic': 'Array', 'mastery': 0.62, 'attempts': 2, 'lastSeen': '2026-11-13', 'weakSubtopics': [], 'relatedTopics': ['Hash Table']},
                {'topic': 'Hash Table', 'mastery': 0.48, 'attempts': 1, 'lastSeen': '2026-11-13', 'weakSubtopics': ['Collision'], 'relatedTopics': ['Array']},
            ],
            'edges': [{'from': 'Array', 'to': 'Hash Table', 'weight': 1}],
            'recentProblems': [], 'dailyAttempts': [],
            'stats': {'totalAttempts': 2, 'accepted': 1, 'averageDurationSec': 60, 'streakDays': 1},
        })
    elif path == '/api/agent/memory/export' and request.method == 'GET':
        route.fulfill(status=200, content_type='application/zip', body=b'PK\x03\x04mock')
    elif path == '/api/submissions' and request.method == 'GET':
        respond(route, body=[])
    elif path == '/api/agent/chat':
        payload = json.loads(request.post_data or '{}')
        assert 'def two_sum' not in payload['message']
        if payload['trainingPhase'] == 'review':
            assert payload['mode'] == 'REVIEW'
            assert payload['goal'] == 'contest'
            respond(route, body={"content": "复盘完成：先验证不变量，再比较复杂度。", "animationId": None})
        else:
            assert payload['goal'] == 'interview_prep'
            respond(route, body={"content": "已按面试目标调整教练建议。", "animationId": None})
    else:
        respond(route, status=404, body={"message": f'unmocked {path}'})

with sync_playwright() as p:
    launch_options = {'headless': True}
    executable = os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE')
    if executable:
        launch_options['executable_path'] = executable
    browser = p.chromium.launch(**launch_options)
    context = browser.new_context(accept_downloads=True)
    page = context.new_page()
    page.route('**/api/**', mock_api)
    page.route('https://fonts.googleapis.com/**', lambda route: route.abort())
    page_errors = []
    browser_console = []
    monaco_asset_requests = []
    page.on('console', lambda msg: browser_console.append(f'{msg.type}: {msg.text}'))
    page.on('requestfailed', lambda req: browser_console.append(f'failed request: {req.url} {req.failure}'))
    page.on('request', lambda req: monaco_asset_requests.append(req.url)
           if any(token in req.url.lower() for token in ('monaco', 'worker', 'typescriptservices')) else None)
    page.on('pageerror', lambda error: page_errors.append(str(error)))
    page.goto(os.environ.get('ALGOCOACH_FRONTEND_URL', 'http://localhost:5173') + '/', wait_until='networkidle')
    page.get_by_role('heading', name='选择一道题目', exact=True).wait_for(timeout=10000)
    assert page.get_by_text('连接 LeetCode').count() == 0
    assert not any(path == '/api/auth/validate' for _, path, _ in calls)
    search = page.get_by_role('textbox', name='搜索当前页题目')
    search.fill('two-sum')
    page.get_by_role('button').filter(has_text='Two Sum').first.click()
    page.get_by_text('两数之和').wait_for(timeout=10000)
    assert page.evaluate('window.problemXss') is None
    assert 'Safe statement' in page.locator('.prose').inner_text()
    assert page.locator('.prose .katex').count() == 1
    page.get_by_label('编程语言').select_option('python3')
    page.locator('#chat-time-remaining').fill('10')
    assert page.get_by_role('option', name='自动判断').count() == 1
    assert page.get_by_role('option', name='赛后补题').count() == 1
    page.reload(wait_until='domcontentloaded')
    page.get_by_role('heading', name='两数之和').wait_for(timeout=10000)
    page.get_by_text('正在确认题面是否有更新…').wait_for(timeout=5000)
    page.get_by_text('Fresh statement after refresh').wait_for(timeout=5000)
    assert problem_detail_calls == 2
    assert page.get_by_label('编程语言').input_value() == 'python3'
    assert page.locator('#chat-time-remaining').input_value() == '10'
    page.locator('.monaco-editor').wait_for(timeout=20000)
    page.locator('[role="textbox"][aria-label="代码编辑器"]').wait_for(state='attached', timeout=5000)
    for language in ('rust', 'cpp', 'python3', 'typescript', 'golang', 'java'):
        page.get_by_label('编程语言').select_option(language)
        assert page.locator('.monaco-editor').count() == 1
    page.get_by_label('编程语言').select_option('python3')
    assert not any(('ts.worker-' in asset or 'json.worker-' in asset or 'html.worker-' in asset or 'css.worker-' in asset)
                   for asset in monaco_asset_requests), monaco_asset_requests
    if os.environ.get('ALGOCOACH_EXPECT_BUNDLED_MONACO') == '1':
        assert any('monaco-' in asset for asset in monaco_asset_requests), monaco_asset_requests
        assert all(url.startswith('http://localhost:4173/') for url in monaco_asset_requests), monaco_asset_requests
    page.screenshot(path='/tmp/algocoach-editor.png', full_page=True)
    print('workspace text:', page.locator('body').inner_text()[:1600])
    print('page errors so far:', page_errors)
    print('editor count:', page.locator('.monaco-editor').count())
    print('browser console:', browser_console[-20:])
    assert page.locator('.monaco-editor').count() == 1
    page.get_by_role('button', name='开始做题（AI 将静默）').click()
    page.get_by_text('专注解题中，AI 已静默').wait_for(timeout=5000)
    page.wait_for_timeout(1300)
    page.reload(wait_until='networkidle')
    page.get_by_role('heading', name='两数之和').wait_for(timeout=10000)
    assert page.get_by_label('编程语言').input_value() == 'python3'
    page.locator('.monaco-editor').wait_for(timeout=20000)
    page.get_by_role('button', name='开始做题（AI 将静默）').click()
    page.get_by_text('专注解题中，AI 已静默').wait_for(timeout=5000)
    editor_accessible = page.locator('[role="textbox"][aria-label="代码编辑器"]')
    editor_accessible.focus()
    assert editor_accessible.get_attribute('aria-label') == '代码编辑器'
    assert page.evaluate('document.activeElement?.getAttribute("aria-label")') == '代码编辑器'
    timer = page.get_by_role('timer')
    timer.wait_for(timeout=5000)
    assert re.search(r'剩余 09:\d\d', timer.inner_text()), timer.inner_text()
    page.get_by_role('button', name='运行').click()
    page.get_by_text('输出：[0, 1]').wait_for(timeout=5000)
    page.get_by_role('button', name='提交').click()
    try:
        page.get_by_text('复盘完成：先验证不变量，再比较复杂度。').wait_for(timeout=10000)
    except Exception:
        print('API calls at review failure:', [(method, path, body[:500]) for method, path, body in calls[-8:]])
        print('messages:', page.locator('body').inner_text()[-1800:])
        print('console:', browser_console[-8:])
        raise
    assert page.get_by_text('复盘', exact=True).is_visible()
    assert not any(path == '/api/auth/validate' for _, path, _ in calls)
    assert not page_errors, page_errors
    page.get_by_role('link', name='知识图谱').click()
    page.get_by_role('img', name='算法知识点掌握度关系图').wait_for(timeout=5000)
    graph_nodes = page.locator('svg g[role=button]')
    assert graph_nodes.count() == 2
    graph_nodes.first.click()
    page.get_by_role('heading', name='Array').wait_for(timeout=3000)
    page.get_by_role('link', name='设置').click()
    language = page.get_by_label('默认编程语言')
    language.select_option('cpp')
    goal = page.get_by_label('教练训练目标')
    goal.select_option('interview_prep')
    assert page.evaluate('localStorage.getItem("algocoach.language")') == 'cpp'
    assert page.evaluate('localStorage.getItem("algocoach.goal")') == 'interview_prep'
    page.get_by_role('link', name='题目列表').click()
    prompt = page.get_by_placeholder('问 AI 教练…（Shift+Enter 换行）')
    prompt.fill('请用面试方式讲解复杂度')
    prompt.press('Enter')
    page.get_by_text('已按面试目标调整教练建议。').wait_for(timeout=5000)
    downloads = []
    page.on('download', lambda download: downloads.append(download))
    page.get_by_role('link', name='设置').click()
    page.get_by_role('button', name='导出数据').click()
    page.get_by_role('status').wait_for(timeout=5000)
    page.wait_for_timeout(300)
    assert sorted(item.suggested_filename for item in downloads) == ['algocoach-memory.zip', 'algocoach-submissions.json']
    page.screenshot(path='/tmp/algocoach-browser.png', full_page=True)
    print('browser smoke passed: anonymous startup, list/search, sanitized math statement, Python starter code, timed FOCUS, run, submit, REVIEW')
    print('mock API calls:', [path for _, path, _ in calls])
    browser.close()
