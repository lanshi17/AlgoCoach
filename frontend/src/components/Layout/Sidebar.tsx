import { useShallow } from 'zustand/react/shallow'
import { BarChart3, BookOpen, ChevronLeft, ChevronRight, Code2, LayoutDashboard, Moon, Settings, Sun, Trophy } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAppStore } from '@/stores/useAppStore'

type NavItem = { to: string; icon: typeof Code2; label: string }

const NAV_GROUPS: ReadonlyArray<{ label: string; items: ReadonlyArray<NavItem> }> = [
  {
    label: '训练',
    items: [
      { to: '/home', icon: LayoutDashboard, label: '学习空间' },
      { to: '/workspace', icon: Code2, label: '编码练习' },
    ],
  },
  {
    label: '档案',
    items: [
      { to: '/progress', icon: Trophy, label: '刷题进度' },
      { to: '/knowledge', icon: BarChart3, label: '知识图谱' },
      { to: '/notebook', icon: BookOpen, label: '学习笔记' },
    ],
  },
]

const SETTINGS_ITEM: NavItem = { to: '/settings', icon: Settings, label: '设置' }

function BrandMark() {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-ink-950 text-canvas">
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
        <path d="M7.4 5.4 3.6 10l3.8 4.6M12.6 5.4 16.4 10l-3.8 4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10" cy="10" r="1.4" fill="currentColor" />
      </svg>
    </span>
  )
}

/**
 * One navigation model, two shapes.
 *
 * Console routes use the 248px labelled rail. The workspace is a dense
 * three-pane surface, so it keeps the 68px icon rail regardless of the stored
 * preference; expanding it there squeezes the editor to an unusable width.
 */
export default function Sidebar() {
  const { pathname } = useLocation()
  const { sidebarExpanded, toggleSidebar, theme, toggleTheme } = useAppStore(useShallow(state => ({
    sidebarExpanded: state.sidebarExpanded,
    toggleSidebar: state.toggleSidebar,
    theme: state.theme,
    toggleTheme: state.toggleTheme,
  })))
  const compactRoute = pathname.startsWith('/workspace')
  const expanded = !compactRoute && sidebarExpanded

  const rowClass = (active: boolean) =>
    `relative flex h-10 items-center rounded-md text-body font-medium transition-colors duration-150
     ${expanded ? 'w-full gap-3 px-3' : 'mx-auto w-10 justify-center'}
     ${active
      ? 'bg-accent-soft text-text-primary'
      : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'}`

  return (
    <aside
      className={`hidden h-full shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 md:flex
                  ${expanded ? 'w-[248px]' : 'w-[68px]'}`}
    >
      <div className={`flex h-[60px] shrink-0 items-center border-b border-border ${expanded ? 'gap-2.5 px-5' : 'justify-center'}`}>
        <BrandMark />
        {expanded && (
          <span className="min-w-0 whitespace-nowrap">
            <span className="block text-body font-semibold tracking-cn text-text-primary">算法练习室</span>
            <span className="mt-0.5 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">AlgoCoach</span>
          </span>
        )}
      </div>

      <nav aria-label="主导航" className={`flex flex-1 flex-col py-4 ${expanded ? 'px-3' : 'px-2.5'}`}>
        {NAV_GROUPS.map((group, index) => (
          <div key={group.label} className={index ? 'mt-5' : ''}>
            {expanded
              ? <p className="px-3 pb-1.5 text-label font-medium text-text-muted">{group.label}</p>
              : index > 0 && <div className="mx-2 mb-3 border-t border-border" />}
            <div className="flex flex-col gap-0.5">
              {group.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/home'}
                  title={expanded ? undefined : label}
                  aria-label={expanded ? undefined : label}
                  className={({ isActive }) => rowClass(isActive)}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute left-0 top-2.5 bottom-2.5 w-[2px] rounded-full bg-accent" />}
                      <Icon size={18} className={`shrink-0 ${isActive ? 'text-accent' : 'text-text-muted'}`} />
                      {expanded && <span className="min-w-0 truncate">{label}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-5">
          {expanded && <p className="px-3 pb-1.5 text-label font-medium text-text-muted">系统</p>}
          <NavLink
            to={SETTINGS_ITEM.to}
            title={expanded ? undefined : SETTINGS_ITEM.label}
            aria-label={expanded ? undefined : SETTINGS_ITEM.label}
            className={({ isActive }) => rowClass(isActive)}
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute left-0 top-2.5 bottom-2.5 w-[2px] rounded-full bg-accent" />}
                <Settings size={18} className={`shrink-0 ${isActive ? 'text-accent' : 'text-text-muted'}`} />
                {expanded && <span className="min-w-0 truncate">{SETTINGS_ITEM.label}</span>}
              </>
            )}
          </NavLink>
        </div>
      </nav>

      <div className={`mb-3 flex flex-col gap-0.5 border-t border-border pt-3 ${expanded ? 'px-3' : 'px-2.5'}`}>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="切换主题"
          title={expanded ? undefined : '切换主题'}
          className={`${rowClass(false)} text-left`}
        >
          {theme === 'dark'
            ? <Sun size={18} className="shrink-0 text-text-muted" />
            : <Moon size={18} className="shrink-0 text-text-muted" />}
          {expanded && <span className="truncate">{theme === 'dark' ? '浅色模式' : '深色模式'}</span>}
        </button>

        {!compactRoute && (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarExpanded ? '收起侧边栏' : '展开侧边栏'}
            aria-expanded={sidebarExpanded}
            title={expanded ? undefined : '展开侧边栏'}
            className={`${rowClass(false)} text-left`}
          >
            {sidebarExpanded
              ? <ChevronLeft size={18} className="shrink-0 text-text-muted" />
              : <ChevronRight size={18} className="shrink-0 text-text-muted" />}
            {expanded && <span className="truncate">收起侧栏</span>}
          </button>
        )}
      </div>
    </aside>
  )
}
