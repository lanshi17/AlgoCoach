import { useShallow } from 'zustand/react/shallow'
import { BarChart3, BookOpen, ChevronLeft, ChevronRight, Code2, LayoutDashboard, Moon, Settings, Sun, Trophy } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAppStore } from '@/stores/useAppStore'

const NAV_ITEMS = [
  { to: '/home', icon: LayoutDashboard, label: '学习空间' },
  { to: '/workspace', icon: Code2, label: '编码练习' },
  { to: '/progress', icon: Trophy, label: '刷题进度' },
  { to: '/knowledge', icon: BarChart3, label: '知识图谱' },
  { to: '/notebook', icon: BookOpen, label: '学习笔记' },
  { to: '/settings', icon: Settings, label: '设置' },
] as const

/**
 * One navigation model, two shapes.
 *
 * Console routes use the 272px labelled rail. The workspace is a dense
 * three-pane surface, so it keeps the 72px icon rail regardless of the stored
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

  return (
    <aside
      className={`hidden h-full shrink-0 flex-col bg-canvas transition-[width] duration-200 md:flex dark:bg-[#0B0C0F]
                  ${expanded ? 'w-[272px]' : 'w-[72px]'}`}
    >
      <div className={`flex h-[84px] shrink-0 items-center gap-3 ${expanded ? 'pl-6' : 'justify-center'}`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white">
          <Code2 size={18} />
        </span>
        {expanded && (
          <span className="min-w-0 whitespace-nowrap">
            <span className="block text-sm font-medium tracking-cn text-text-primary dark:text-text-dark-primary">算法练习室</span>
            <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-text-muted dark:text-text-dark-muted">local code desk</span>
          </span>
        )}
      </div>

      <nav aria-label="主导航" className={`flex flex-1 flex-col gap-1 py-4 ${expanded ? 'px-5' : 'px-3'}`}>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/home'}
            title={expanded ? undefined : label}
            aria-label={expanded ? undefined : label}
            className={({ isActive }) =>
              `relative flex h-9 items-center rounded-full text-body tracking-cn transition-[background-color,color,font-weight] duration-150
               ${expanded ? 'w-full pl-10 pr-3' : 'mx-auto w-10 justify-center'}
               ${isActive
                 ? 'bg-border font-medium text-text-primary dark:bg-surface-dark-muted dark:text-text-dark-primary'
                 : 'text-text-secondary hover:bg-surface-muted hover:font-medium hover:text-text-primary dark:text-text-dark-secondary dark:hover:bg-surface-dark-muted dark:hover:text-text-dark-primary'}`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`absolute top-0 flex h-9 w-5 items-center justify-center ${expanded ? 'left-2' : 'left-1/2 -translate-x-1/2'} ${isActive ? 'text-accent' : ''}`}>
                  <Icon size={20} className="shrink-0" />
                </span>
                {expanded && <span className="min-w-0 truncate">{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={`mb-4 flex flex-col gap-1 ${expanded ? 'px-5' : 'px-3'}`}>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="切换主题"
          title={expanded ? undefined : '切换主题'}
          className={`relative flex h-9 items-center rounded-full text-body tracking-cn text-text-secondary transition-[background-color,color,font-weight] duration-150 hover:bg-surface-muted hover:font-medium hover:text-text-primary dark:text-text-dark-secondary dark:hover:bg-surface-dark-muted dark:hover:text-text-dark-primary
                      ${expanded ? 'w-full pl-10 pr-3' : 'mx-auto w-10 justify-center'}`}
        >
          <span className={`absolute top-0 flex h-9 w-5 items-center justify-center ${expanded ? 'left-2' : 'left-1/2 -translate-x-1/2'}`}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </span>
          {expanded && <span className="truncate">{theme === 'dark' ? '浅色模式' : '深色模式'}</span>}
        </button>

        {!compactRoute && (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarExpanded ? '收起侧边栏' : '展开侧边栏'}
            aria-expanded={sidebarExpanded}
            title={expanded ? undefined : '展开侧边栏'}
            className={`relative flex h-9 items-center rounded-full text-body tracking-cn text-text-secondary transition-[background-color,color,font-weight] duration-150 hover:bg-surface-muted hover:font-medium hover:text-text-primary dark:text-text-dark-secondary dark:hover:bg-surface-dark-muted dark:hover:text-text-dark-primary
                        ${expanded ? 'w-full pl-10 pr-3' : 'mx-auto w-10 justify-center'}`}
          >
            <span className={`absolute top-0 flex h-9 w-5 items-center justify-center ${expanded ? 'left-2' : 'left-1/2 -translate-x-1/2'}`}>
              {sidebarExpanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </span>
            {expanded && <span className="truncate">收起侧栏</span>}
          </button>
        )}
      </div>
    </aside>
  )
}
