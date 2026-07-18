import { useState } from 'react'
import { useStore } from '../store/StoreContext'
import { memberTotal, switchMember } from '../store/logic'
import { navigate } from '../router'
import { IconLogout } from './icons'

export function TopBar() {
  const { state, mutate } = useStore()
  const [open, setOpen] = useState(false)
  const current = state.members.find((m) => m.id === state.currentMemberId)!
  const total = memberTotal(state, current.id)

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      {/* 成员切换 */}
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-2 pr-3 text-sm font-medium text-slate-700 shadow-sm hover:border-indigo-200"
        >
          <span className="text-lg">{current.avatar}</span>
          <span>{current.name}</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            {total} 分
          </span>
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-lg">
              {state.members.map((m) => {
                const active = m.id === current.id
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      mutate((s) => switchMember(s, m.id))
                      setOpen(false)
                    }}
                    className={
                      'flex w-full items-center gap-2 px-3 py-2 text-sm ' +
                      (active ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50')
                    }
                  >
                    <span className="text-lg">{m.avatar}</span>
                    <span className="flex-1 text-left">{m.name}</span>
                    <span className="text-xs text-slate-400">{memberTotal(state, m.id)} 分</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* 右侧积分 + 返回首页 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
          <span>👑</span>
          {total} 积分
        </div>
        <button
          onClick={() => navigate('dashboard')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <IconLogout width={18} height={18} />
          返回首页
        </button>
      </div>
    </header>
  )
}
