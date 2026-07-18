import type { ReactNode } from 'react'
import { navigate, useHashRoute, type RouteKey } from '../router'
import {
  IconHome,
  IconTasks,
  IconGift,
  IconReceipt,
  IconChart,
  IconSettings,
  IconChevronLeft,
} from './icons'

const NAV: { key: RouteKey; label: string; icon: (p: { width?: number; height?: number }) => ReactNode }[] = [
  { key: 'dashboard', label: '首页大盘', icon: IconHome },
  { key: 'tasks', label: '任务打卡', icon: IconTasks },
  { key: 'prizes', label: '奖品池', icon: IconGift },
  { key: 'records', label: '兑换记录', icon: IconReceipt },
  { key: 'stats', label: '数据统计', icon: IconChart },
  { key: 'parent', label: '家长面板', icon: IconSettings },
]

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const route = useHashRoute()
  return (
    <aside
      className={
        'flex shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-200 ' +
        (collapsed ? 'w-[72px]' : 'w-56')
      }
    >
      {/* Logo */}
      <div className="flex h-16 items-center px-5">
        {collapsed ? (
          <span className="text-2xl">🏆</span>
        ) : (
          <span className="bg-brand-gradient bg-clip-text text-lg font-extrabold text-transparent">
            家庭积分乐园
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 px-3 pt-2">
        {NAV.map((item) => {
          const active = route === item.key
          const Icon = item.icon
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              title={item.label}
              className={
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ' +
                (active
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700') +
                (collapsed ? ' justify-center' : '')
              }
            >
              <Icon width={20} height={20} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="mx-3 mb-3 flex items-center justify-center gap-1.5 rounded-xl border-t border-slate-100 py-3 text-xs text-slate-400 hover:text-slate-600"
      >
        <IconChevronLeft
          width={16}
          height={16}
          style={{ transform: collapsed ? 'rotate(180deg)' : undefined }}
        />
        {!collapsed && '收起导航'}
      </button>
    </aside>
  )
}
