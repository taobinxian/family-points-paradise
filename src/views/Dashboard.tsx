import { useState } from 'react'
import { useStore } from '../store/StoreContext'
import {
  memberTotal,
  todayEarned,
  todayProgress,
  todayCheckinCount,
  applicableTasks,
  completionStatusFor,
  redeemableCount,
  virtualRewards,
  redeemableWishes,
  memberById,
  checkInTask,
} from '../store/logic'
import { todayStr } from '../data/constants'
import { navigate } from '../router'
import { Card, StatCard, Button, Badge, SectionTitle, EmptyState, Modal } from '../components/ui'
import {
  IconTrophy,
  IconTarget,
  IconCheck,
  IconSparkles,
  IconZap,
  IconGift,
  IconChart,
  IconSettings,
  IconTasks,
} from '../components/icons'

export function Dashboard() {
  const { state, mutate, toast } = useStore()
  const [quickOpen, setQuickOpen] = useState(false)
  const member = memberById(state, state.currentMemberId)!
  const total = memberTotal(state, member.id)
  const earned = todayEarned(state, member.id)
  const prog = todayProgress(state, member.id)
  const tasks = applicableTasks(state, member.id)
  const virtuals = virtualRewards(state)
  const wishes = redeemableWishes(state, member.id)

  const ranked = [...state.members].sort((a, b) => memberTotal(state, b.id) - memberTotal(state, a.id))

  return (
    <div className="space-y-5">
      {/* 页头 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">
            {member.avatar} {member.name} 的积分大盘
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {todayStr()} · 当前查看：{member.name}
          </p>
        </div>
        <Button onClick={() => setQuickOpen(true)}>
          <IconZap width={18} height={18} />
          快速打卡
        </Button>
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard tone="indigo" icon={<IconTrophy width={22} height={22} />} label="总积分" value={total} />
        <StatCard
          tone="emerald"
          icon={<IconCheck width={22} height={22} />}
          label="今日完成"
          value={`${prog.done}/${prog.total}`}
        />
        <StatCard
          tone="amber"
          icon={<IconTarget width={22} height={22} />}
          label="完成率"
          value={`${prog.rate}%`}
        />
        <StatCard
          tone="violet"
          icon={<IconSparkles width={22} height={22} />}
          label="今日积分"
          value={`+${earned}`}
        />
      </div>

      {/* 积分榜 + 可兑换 */}
      <Card className="p-6">
        <SectionTitle icon={<span className="text-xl">🏆</span>}>家庭成员积分榜</SectionTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {ranked.map((m, i) => {
            const t = memberTotal(state, m.id)
            const active = m.id === member.id
            return (
              <div
                key={m.id}
                className={
                  'relative rounded-2xl border p-4 ' +
                  (active
                    ? 'border-indigo-200 bg-indigo-50/60 ring-1 ring-indigo-200'
                    : 'border-slate-100 bg-white')
                }
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span className="text-2xl">{m.avatar}</span>
                    {i > 0 && (
                      <span className="absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 text-[10px] font-bold text-white">
                        {i + 1}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">{m.name}</div>
                    <div className="text-xs text-slate-400">
                      今日 {todayCheckinCount(state, m.id)} 次打卡
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-extrabold text-indigo-600">{t}</div>
                    <div className="text-xs text-slate-400">总积分</div>
                  </div>
                  <Badge tone="green">+{todayEarned(state, m.id)} 今日</Badge>
                </div>
              </div>
            )
          })}
        </div>

        {/* 可兑换（虚拟奖励） */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
            <IconGift width={16} height={16} /> {member.name} 可兑换
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {virtuals.map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
                <span className="text-2xl">{v.emoji}</span>
                <div>
                  <div className="font-semibold text-slate-800">{v.name}</div>
                  <div className="text-xs text-slate-400">
                    可兑换 <span className="font-semibold text-indigo-600">{redeemableCount(state, member.id, v)}</span> 次（每次 {v.cost} 积分）
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* 今日进度 + 快捷操作 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <SectionTitle icon={<IconCheck width={20} height={20} className="text-emerald-500" />}>
            {member.name} 今日打卡进度
          </SectionTitle>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <div className="text-xs text-slate-400">完成率</div>
              <div className="text-3xl font-extrabold text-slate-800">{prog.rate}%</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">已完成</div>
              <div>
                <span className="text-2xl font-bold text-emerald-500">{prog.done}</span>
                <span className="text-sm text-slate-400"> / {prog.total} 项任务</span>
              </div>
            </div>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-gradient transition-all"
              style={{ width: `${prog.rate}%` }}
            />
          </div>
          <div className="mt-4 space-y-1">
            {tasks.map((t) => {
              const status = completionStatusFor(state, member.id, t.id)
              return (
                <div key={t.id} className="flex items-center justify-between rounded-lg px-1 py-2">
                  <div className="flex items-center gap-2.5">
                    {status === 'confirmed' ? (
                      <span className="text-lg">✅</span>
                    ) : status === 'pending' ? (
                      <span className="text-lg">🕒</span>
                    ) : (
                      <span className="inline-block h-5 w-5 rounded-md border-2 border-slate-200" />
                    )}
                    <span
                      className={
                        status === 'confirmed' ? 'text-slate-400 line-through' : 'text-slate-700'
                      }
                    >
                      {t.name}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-slate-400">+{t.points}分</span>
                </div>
              )
            })}
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle icon={<IconSparkles width={20} height={20} className="text-violet-500" />}>
            快捷操作
          </SectionTitle>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <QuickAction
              tone="from-indigo-500 to-violet-500"
              icon={<IconTasks width={22} height={22} />}
              title="快速打卡"
              subtitle="为当前孩子完成常用任务"
              onClick={() => setQuickOpen(true)}
            />
            <QuickAction
              tone="from-pink-500 to-rose-500"
              icon={<IconGift width={22} height={22} />}
              title="奖品池"
              subtitle="查看心愿奖品"
              onClick={() => navigate('prizes')}
            />
            <QuickAction
              tone="from-sky-500 to-blue-500"
              icon={<IconChart width={22} height={22} />}
              title="数据统计"
              subtitle="查看本周本月统计"
              onClick={() => navigate('stats')}
            />
            <QuickAction
              tone="from-slate-600 to-slate-700"
              icon={<IconSettings width={22} height={22} />}
              title="家长面板"
              subtitle="管理任务和审核"
              onClick={() => navigate('parent')}
            />
          </div>
        </Card>
      </div>

      {/* 心愿单 */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <SectionTitle icon={<IconGift width={20} height={20} className="text-pink-500" />}>
            {member.name} 的心愿单
          </SectionTitle>
          <button
            onClick={() => navigate('prizes')}
            className="text-sm font-medium text-indigo-500 hover:text-indigo-600"
          >
            查看全部
          </button>
        </div>
        {wishes.length === 0 ? (
          <EmptyState emoji="🎁" text={`${member.name} 暂无可兑换奖品`} />
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {wishes.map((w) => (
              <div key={w.id} className="rounded-xl border border-slate-100 p-4">
                <div className="text-2xl">{w.emoji}</div>
                <div className="mt-2 font-semibold text-slate-800">{w.name}</div>
                <div className="text-sm text-indigo-600">{w.cost} 积分</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 快速打卡弹框 */}
      <Modal open={quickOpen} onClose={() => setQuickOpen(false)} title={`为 ${member.name} 快速打卡`}>
        <div className="space-y-2">
          {tasks.map((t) => {
            const status = completionStatusFor(state, member.id, t.id)
            return (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{t.emoji}</span>
                  <div>
                    <div className="font-medium text-slate-700">{t.name}</div>
                    <div className="text-xs text-slate-400">+{t.points} 分</div>
                  </div>
                </div>
                {status === 'confirmed' ? (
                  <Badge tone="green">已完成</Badge>
                ) : status === 'pending' ? (
                  <Badge tone="orange">待确认</Badge>
                ) : (
                  <Button
                    variant="soft"
                    onClick={() => {
                      mutate((s) => checkInTask(s, member.id, t.id))
                      toast('打卡已提交，等待家长确认')
                    }}
                  >
                    打卡
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}

function QuickAction({
  tone,
  icon,
  title,
  subtitle,
  onClick,
}: {
  tone: string
  icon: React.ReactNode
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-slate-100 p-4 text-left transition hover:shadow-card-hover"
    >
      <div
        className={
          'mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white ' +
          tone
        }
      >
        {icon}
      </div>
      <div className="font-semibold text-slate-800">{title}</div>
      <div className="text-xs text-slate-400">{subtitle}</div>
    </button>
  )
}
