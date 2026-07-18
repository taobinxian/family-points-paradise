import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useHashRoute } from '../router'
import { Dashboard } from '../views/Dashboard'
import { Tasks } from '../views/Tasks'
import { Prizes } from '../views/Prizes'
import { Records } from '../views/Records'
import { Stats } from '../views/Stats'
import { ParentPanel } from '../views/ParentPanel'

export function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const route = useHashRoute()

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="relative flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-6 py-6">
            {route === 'dashboard' && <Dashboard />}
            {route === 'tasks' && <Tasks />}
            {route === 'prizes' && <Prizes />}
            {route === 'records' && <Records />}
            {route === 'stats' && <Stats />}
            {route === 'parent' && <ParentPanel />}
          </div>
          {/* 中性水印（不冒用第三方品牌） */}
          <div className="pointer-events-none fixed bottom-4 right-4 z-10 flex items-center gap-1.5 rounded-lg bg-slate-900/85 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
            <span>⚡</span> 家庭积分乐园 · 复刻版
          </div>
        </main>
      </div>
    </div>
  )
}
