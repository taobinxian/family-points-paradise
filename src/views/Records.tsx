import { useStore } from '../store/StoreContext'
import { memberById, memberTotal } from '../store/logic'
import { Card, Badge } from '../components/ui'
import { MemberChips } from '../components/MemberChips'
import type { LedgerEntry, LedgerTag } from '../types'

const TAG_TONE: Record<LedgerTag, 'green' | 'amber' | 'rose' | 'indigo'> = {
  任务所得: 'green',
  调整: 'amber',
  兑换: 'rose',
  额外奖励: 'indigo',
}

function fmtTime(iso: string): string {
  return iso.replace('T', ' ').slice(0, 16)
}

export function Records() {
  const { state } = useStore()
  const member = memberById(state, state.currentMemberId)!
  const total = memberTotal(state, member.id)
  const entries = state.ledger
    .filter((l) => l.memberId === member.id)
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  return (
    <div className="space-y-5">
      {/* 页头 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-800">
          📊 积分明细
        </h1>
        <MemberChips />
      </div>

      {/* 总积分横幅 */}
      <div className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 px-6 py-6">
        <div>
          <div className="text-sm text-slate-500">{member.name} 的总积分</div>
          <div className="text-4xl font-extrabold text-indigo-600">{total}</div>
        </div>
        <span className="text-4xl">{member.avatar}</span>
      </div>

      {/* 积分记录 */}
      <Card className="p-6">
        <h2 className="text-lg font-bold text-slate-800">积分记录</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {entries.length === 0 && (
            <div className="py-10 text-center text-sm text-slate-400">暂无积分记录</div>
          )}
          {entries.map((e) => (
            <LedgerRow key={e.id} entry={e} />
          ))}
        </div>
      </Card>
    </div>
  )
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const positive = entry.points > 0
  return (
    <div className="flex items-center gap-3 py-3.5">
      <div
        className={
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ' +
          (entry.tag === '调整'
            ? 'bg-amber-100 text-amber-600'
            : positive
              ? 'bg-emerald-100 text-emerald-600'
              : 'bg-rose-100 text-rose-600')
        }
      >
        {entry.tag === '调整' ? '±' : positive ? '↑' : '↓'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-slate-700">{entry.description}</span>
          <Badge tone={TAG_TONE[entry.tag]}>{entry.tag}</Badge>
        </div>
        <div className="text-xs text-slate-400">{fmtTime(entry.createdAt)}</div>
      </div>
      <div className={'text-lg font-bold ' + (positive ? 'text-emerald-500' : 'text-rose-500')}>
        {positive ? '+' : ''}
        {entry.points}
      </div>
    </div>
  )
}
