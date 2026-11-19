import { BarChart3, BookOpen, Code2, LayoutDashboard, Settings, Trophy } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/home', icon: LayoutDashboard, label: '学习空间' },
  { to: '/workspace', icon: Code2, label: '编码练习' },
  { to: '/progress', icon: Trophy, label: '刷题进度' },
  { to: '/knowledge', icon: BarChart3, label: '知识图谱' },
  { to: '/notebook', icon: BookOpen, label: '学习笔记' },
  { to: '/settings', icon: Settings, label: '设置' },
] as const

export default function MobileTabBar() {
  return (
    <nav
      aria-label="主导航"
      className="flex shrink-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden dark:border-border-dark dark:bg-surface-dark"
    >
      {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/home'}
          className={({ isActive }) =>
            `flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 pb-1 text-[11px] leading-3 tracking-cn transition-colors duration-150
             ${isActive
               ? 'font-medium text-accent'
               : 'text-text-secondary hover:text-text-primary dark:text-text-dark-secondary dark:hover:text-text-dark-primary'}`
          }
        >
          <Icon size={20} className="shrink-0" />
          <span className="max-w-full truncate">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
