import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { BookOpen, Trophy, BarChart3, Settings, ChevronLeft, ChevronRight, Sparkles, Sun, Moon } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAppStore } from '@/stores/useAppStore'

const NAV_ITEMS = [
  { to: '/workspace', icon: BookOpen, label: '题目列表' },
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
      className={`flex flex-col items-stretch border-r border-border dark:border-border-dark
                 bg-surface-soft dark:bg-surface-dark-soft transition-all duration-200 flex-shrink-0 w-14
                 ${sidebarExpanded ? 'md:w-[var(--sidebar-expanded-w)]' : ''}`}
    >
      {/* Logo / brand */}
      <div className="flex items-center gap-2 h-[48px] px-3 border-b border-border dark:border-border-dark">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent text-white shrink-0">
          <Sparkles size={18} />
        </div>
        {sidebarExpanded && (
          <span className="hidden md:inline font-semibold text-sm text-text-primary dark:text-text-dark-primary whitespace-nowrap">
            AlgoCoach
          </span>
        )}
      </div>

      {/* Nav list */}
      <nav className="flex flex-col gap-1 p-2 flex-1">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `sidebar-btn ${isActive ? 'active' : ''} ${sidebarExpanded ? 'justify-start gap-3 px-3 w-full' : 'mx-auto'}`
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
      <div className="mb-2 flex flex-col items-center gap-1">
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
