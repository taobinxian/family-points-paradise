import { useStore } from '../store/StoreContext'
import { switchMember } from '../store/logic'

/** 视图内的成员切换 chip（陶睿楷 / 陶悠杨），与顶栏共享 currentMemberId */
export function MemberChips() {
  const { state, mutate } = useStore()
  return (
    <div className="flex flex-wrap gap-2">
      {state.members.map((m) => {
        const active = m.id === state.currentMemberId
        return (
          <button
            key={m.id}
            onClick={() => mutate((s) => switchMember(s, m.id))}
            className={
              'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition ' +
              (active
                ? 'bg-brand-gradient text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-indigo-200')
            }
          >
            <span className="text-base">{m.avatar}</span>
            {m.name}
          </button>
        )
      })}
    </div>
  )
}
