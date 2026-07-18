import { useState } from 'react'
import { useStore } from '../store/StoreContext'
import {
  memberById,
  memberTotal,
  todayCheckinCount,
  applicableTasks,
  completionStatusFor,
  checkInTask,
  undoCheckIn,
} from '../store/logic'
import { Card, Badge, Button } from '../components/ui'
import { MemberChips } from '../components/MemberChips'
import { IconCheck, IconClock } from '../components/icons'

export function Tasks() {
  const { state, mutate, toast } = useStore()
  const member = memberById(state, state.currentMemberId)!
  const tasks = applicableTasks(state, member.id)

  const cats = state.categories.filter((c) => tasks.some((t) => t.categoryId === c.id))
  const [activeCat, setActiveCat] = useState(cats[0]?.id ?? '')
  const currentCat = cats.some((c) => c.id === activeCat) ? activeCat : (cats[0]?.id ?? '')
  const shown = tasks.filter((t) => t.categoryId === currentCat)

  return (
    <div className="space-y-5">
      {/* 概览卡 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex items-center gap-4 p-5">
          <span className="text-4xl">{member.avatar}</span>
          <div>
            <div className="text-sm text-slate-400">{member.name} · 今日打卡</div>
            <div className="text-2xl font-extrabold text-indigo-600">
              {todayCheckinCount(state, member.id)} 次
            </div>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <span className="text-4xl">💎</span>
          <div>
            <div className="text-sm text-slate-400">当前积分</div>
            <div className="text-2xl font-extrabold text-indigo-600">{memberTotal(state, member.id)}</div>
          </div>
        </Card>
      </div>

      <MemberChips />

      {/* 分类 tab */}
      <div className="flex flex-wrap gap-2">
        {cats.map((c) => {
          const active = c.id === currentCat
          return (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={
                'flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ' +
                (active
                  ? 'bg-brand-gradient text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-indigo-200')
              }
            >
              <span>{c.emoji}</span>
              {c.name}
            </button>
          )
        })}
      </div>

      {/* 任务卡 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((t) => {
          const status = completionStatusFor(state, member.id, t.id)
          const confirmed = status === 'confirmed'
          const pending = status === 'pending'
          return (
            <Card
              key={t.id}
              className={
                'p-5 ' +
                (confirmed
                  ? '!border-emerald-200 bg-emerald-50/60'
                  : pending
                    ? '!border-orange-200 bg-orange-50/40'
                    : '')
              }
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{t.emoji}</span>
                  <span className="font-bold text-slate-800">{t.name}</span>
                </div>
                <Badge tone="green">+{t.points} 分</Badge>
              </div>
              {t.shared && (
                <div className="mt-3">
                  <Badge tone="orange">👥 共同任务</Badge>
                </div>
              )}
              <div className="mt-4">
                {confirmed ? (
                  <Button variant="success" className="w-full !cursor-default !opacity-100">
                    <IconCheck width={18} height={18} /> 已完成
                  </Button>
                ) : pending ? (
                  <Button
                    variant="ghost"
                    className="w-full !bg-orange-100 !text-orange-600"
                    onClick={() => {
                      const pendingCp = state.completions.find(
                        (c) => c.memberId === member.id && c.taskId === t.id && c.status === 'pending',
                      )
                      if (pendingCp) {
                        mutate((s) => undoCheckIn(s, pendingCp.id))
                        toast('已撤销打卡', 'info')
                      }
                    }}
                  >
                    <IconClock width={18} height={18} /> 待确认（点击撤销）
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => {
                      mutate((s) => checkInTask(s, member.id, t.id))
                      toast('打卡已提交，等待家长确认')
                    }}
                  >
                    完成打卡
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
