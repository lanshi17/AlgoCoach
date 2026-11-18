import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Trophy, BarChart3, Settings, ChevronLeft, ChevronRight, Code2, LayoutDashboard, Sun, Moon } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAppStore } from '@/stores/useAppStore'

const NAV_ITEMS = [
  { to: '/home', icon: LayoutDashboard, label: '学习空间' },
  { to: '/workspace', icon: Code2, label: '编码练习' },
  { to: '/progress', icon: Trophy, label: '刷题进度' },
  { to: '/knowledge', icon: BarChart3, label: '知识图谱' },
  { to: '/settings', icon: Settings, label: '设置' },
] as const

/**
 * Qwen-style collapsible left sidebar.
 * Collapsed: 56px icon rail. Expanded: 220px with labels.
 */
export default function Sidebar() {
  const { sidebarExpanded, toggleSidebar, theme, toggleTheme } = useAppStore(useShallow(state => ({
    sidebarExpanded: state.sidebarExpanded,
    toggleSidebar: state.toggleSidebar,
    theme: state.theme,
    toggleTheme: state.toggleTheme,
  })))

  return (
    <aside
      className={`flex flex-col items-stretch bg-canvas dark:bg-[#0B0C0F] transition-[width] duration-200 flex-shrink-0
                 w-[var(--sidebar-w)] ${sidebarExpanded ? 'md:w-[var(--sidebar-expanded-w)]' : ''}`}
    >
      {/* Logo / brand */}
      <div className="flex h-[84px] items-center gap-3 px-3 md:px-6">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white">
          <Code2 size={18} />
        </div>
        {sidebarExpanded && (
          <span className="hidden md:inline whitespace-nowrap text-text-primary dark:text-text-dark-primary">
            <span className="block font-editorial text-sm font-medium">算法练习室</span>
            <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-text-muted dark:text-text-dark-muted">local code desk</span>
          </span>
        )}
      </div>

      {/* Nav list */}
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4 md:px-5">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `sidebar-btn ${isActive ? 'active' : ''} ${sidebarExpanded ? 'w-full justify-start gap-2 pl-10 pr-3' : 'mx-auto w-10'}`
            }
            title={label}
            aria-label={label}
          >
            <Icon size={20} className="shrink-0" />
            {sidebarExpanded && <span className="hidden md:inline text-sm whitespace-nowrap">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Shell controls: theme (all routes) and collapse (desktop) */}
      <div className="mb-4 flex flex-col items-center gap-1 px-3 md:px-5">
        <button onClick={toggleTheme} type="button" aria-label="切换主题" className="sidebar-btn">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          onClick={toggleSidebar}
          type="button"
          aria-label={sidebarExpanded ? '收起侧边栏' : '展开侧边栏'}
          aria-expanded={sidebarExpanded}
          className="sidebar-btn hidden md:flex"
        >
          {sidebarExpanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>
    </aside>
  )
}
