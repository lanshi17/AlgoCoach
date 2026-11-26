# TASK-2026-11-26-app-shell-visual-system — rebuild the console shell and visual system

Type: refactor
Tier: T2
Tooling: repo-native (omp, 2026-11-26)
Risk: medium
Design status: draft
Implementation: implemented
Verification: passed
Evidence: valid (EVIDENCE-184/185/186/187)

## Objective

Give every route one coherent product surface. The current shell is a stack of
rounded white slabs on a blue-tinted canvas: a 272px pill-navigation rail with a
decorative "LOCAL CODE DESK" kicker, seven different page widths, 24px panel radii
with no rules, and a 84px workspace header with an extra 34px layout strip below
it. Navigation, page mastheads, typography, and containers read as separate
templates rather than one training desk.

Rebuild the shell and the visual system without changing product behavior:

- one rail with a brand lockup, grouped navigation, and a ruled active state;
- one page masthead (title, icon tile, actions, bottom hairline) and two content
  widths — `wide` for tables/graphs/dashboards, `narrow` for forms and readers;
- one neutral palette (zinc canvas, true-white surfaces, hairline rules, a
  deepened ultramarine accent), 8–12px control/container radii, and a real type
  scale (`display`/`page`/`section`/`body`/`meta`/`label`);
- a compact 60px workspace header plus a 36px layout strip, so the panel canvas
  gains 22px of height at `xl`;
- squared controls everywhere except status/difficulty pills, which stay round.

No route, workflow, shortcut, FOCUS rule, persistence key, or gateway contract
changes. Layout state (`--problem-w`, `--chat-w`, floats, presets) is untouched.

## Acceptance conditions

- AC-1: `/home`, `/learning/dashboard`, `/workspace`, `/progress`, `/knowledge`,
  `/knowledge/graph`, `/knowledge/lib`rary, `/notebook`, `/settings`, and
  `/settings/platforms` all render through the same shell tokens, masthead, and
  gutter rules; no route declares its own page width outside `PageShell`.
- AC-2: the sidebar is one component with two widths (68/248), a brand mark,
  grouped navigation, a ruled active item, and theme + collapse controls;
  `/workspace` stays on the compact rail.
- AC-3: the workspace header is ≤60px at `xl`, drops the decorative kicker, keeps
  language, mode, timer, run/submit/stop, and error affordances, and the layout
  strip is ≤36px with the same presets, save/reset, and dock/float actions.
- AC-4: `FOCUS` still hides every AI surface (chat panel docked or floating,
  mobile coach tab, guided submission), keeps the focus bar, and the editor
  remains editable.
- AC-5: light and dark themes both use the new tokens; no page keeps a hardcoded
  `#0B0C0F`/`#111317` surface outside the token definitions.
- AC-6: mobile (`<md`) keeps the six-tab bar and per-panel switcher, with 44px+
  touch targets and no horizontal overflow at 390px.
- AC-7: existing shell, guided, notebook, settings, progress, and graph tests
  pass unchanged; `tsc` and lint are clean.

## Scope

- Target entities: `MOD-SHELL`, `MOD-NAV`, `MOD-WORKSPACE-LAYOUT`, `MOD-DOCS`.
- Write scope: `frontend/tailwind.config.ts`, `frontend/src/index.css`,
  `frontend/src/components/Common/{PageHeader,PageShell,Button,Badge,Segmented}.tsx`,
  `frontend/src/components/Layout/{Sidebar,MobileTabBar,Header,AppShell}.tsx`,
  `frontend/src/pages/*.tsx` (page chrome only), `docs/frontend.md`, this record.
- Protected paths: none. No `data/**`, no workflow files, no release artifacts.
- Dependencies: existing tokens referenced by `ProblemPanel`, `EditorPanel`,
  `ChatPanel`, `AnimationCard`; their class names stay valid.

## Design decisions

1. **Neutral canvas, white surfaces, hairlines.** Canvas `#F3F4F6`, surface
   `#FFFFFF`, border `#E2E4E8`; dark canvas `#0B0C0E`. Panels are separated by
   rules, not shadows. Only floating panels keep elevation.
2. **Contest-desk typography.** Page titles 22px/600 with −0.015em tracking,
   section titles 13px/600, body 13.5/22, meta 12/18, latin labels 10.5/14 with
   0.08em tracking. Tabular numerals for timers and statistics. Body tracking
   drops from 0.4px to 0.02em.
3. **One accent, squared chrome.** Accent deepens to `#4A45E8` (light) /
   `#9A96FF` (dark) for AA text contrast on white. Controls get 8px radii;
   containers 12px; pills survive only for difficulty/status.
4. **Two widths.** `wide` = 1200px (learning, progress, graph, notebook,
   knowledge library), `narrow` = 880px (settings, platform login). Mastheads
   share a bottom hairline and 32px bottom gap.
5. **Guided page is a workspace, not a reader.** It keeps its own full-height
   grid and code float, but adopts the masthead rule, control shapes, and title
   scale; its "学习工作区" kicker is deleted.
6. **Density in the coding surface.** Workspace header 60px, layout strip 36px,
   panel gutter 12px, panel radius 12px. The editor keeps `--code-*` variables,
   remapped to the new palette.
7. **Guided layout stacks before it crushes.** Three columns only from 1360px;
   below that outline, coach, and code stack in one scrolling page. Column
   clamping is skipped while stacked so a narrow window cannot permanently
   overwrite the learner's saved widths.

Scope note: the same chrome pass reached `ChatPanel` (44px header, squared
composer and training controls), `ProblemPanel` (masthead, squared start CTA,
localized gateway errors), and both code toolbars (`GuidedCodeEditor`,
`EditorPanel`) because they are the visible chrome of the coding surface.

## Trace table (code → design)

| Entity | Implementation | Verification |
|--------|----------------|--------------|
| `MOD-SHELL` | `AppShell.tsx`, `PageShell.tsx` | `AppShell.test.tsx`, browser |
| `MOD-NAV` | `Sidebar.tsx`, `MobileTabBar.tsx` | `Sidebar.test.tsx`, browser |
| `MOD-WORKSPACE-LAYOUT` | `Header.tsx`, workspace strip, panel classes | `Header.test.tsx`, `AppShell.test.tsx` |
| `MOD-DOCS` | `docs/frontend.md` §2/§3.2/§3.3 + shell section | docs link check |

## Verification

Environment: Linux 7.0.0-43-generic x64; Node 24.13.0 / npm 11.17.0; Vitest 1.6.1
(jsdom); Chromium via the browser helper. Input manifest: the 25 changed source
and doc files listed in `git status`, excluding this record; aggregate digest
`701590b696ad06780b635866caad15ae9c031fe0b818effd269d04811ab7ed56`
over sorted `sha256<two spaces>path` lines.

```text
EVIDENCE-184  frontend typecheck
task: TASK-2026-11-26-app-shell-visual-system
target_entities: MOD-SHELL, MOD-NAV, MOD-WORKSPACE-LAYOUT
checker: tsc
command: npx tsc --noEmit
cwd: frontend/
started_at / finished_at: 2026-11-26T13:25:23Z / 2026-11-26T13:25:26Z
exit_code: 0
result: no diagnostics
```

```text
EVIDENCE-185  frontend lint
task: TASK-2026-11-26-app-shell-visual-system
checker: eslint
command: npm run lint
cwd: frontend/
started_at / finished_at: 2026-11-26T13:25:26Z / 2026-11-26T13:25:28Z
exit_code: 0
result: eslint src --ext ts,tsx, no warnings
```

```text
EVIDENCE-186  frontend tests
task: TASK-2026-11-26-app-shell-visual-system
checker: vitest
command: npm test
cwd: frontend/
started_at / finished_at: 2026-11-26T13:25:27Z / 2026-11-26T13:25:35Z
exit_code: 0
result: 48 files, 314 tests passed
```

```text
EVIDENCE-187  docs links
task: TASK-2026-11-26-app-shell-visual-system
checker: check-docs-links.py
command: python3 scripts/check-docs-links.py docs/frontend.md
cwd: repository root
started_at / finished_at: 2026-11-26T13:27:00Z / 2026-11-26T13:27:01Z
exit_code: 0
result: checked 0 links and 0 id references in 1 file — ok
```

Browser QA (Chromium via the browser helper; light and dark):
- `1440×900`: `/home`, `/workspace`, `/learning/dashboard`, `/progress`,
  `/knowledge`, `/knowledge/graph`, `/notebook`, `/settings`,
  `/settings/platforms`; masthead, rail, and panel rhythm consistent.
- `1360×850` and `1024×800`: guided page switches between three columns and
  stacked flow; `390×844`: all routes; `document.scrollWidth === clientWidth`
  on every captured route.
- Interaction pass: rail collapses 248→68px and expands back; preset
  `宽编辑器` sets the problem panel to 300px; chat floats (`AI 教练浮窗`) and
  re-docks; theme toggle flips light/dark and the `dark` class.

Residual: the app-level gateway-offline banner and the problem panel's
"题库服务返回 500" alert both appear while the Java gateway is stopped; the
second is the panel's own fetch state and is intentionally kept, now in Chinese.
The design is not marked `approved`: that status belongs to the user.
