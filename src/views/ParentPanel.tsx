import { useRef, useState } from 'react'
import { useStore } from '../store/StoreContext'
import {
  memberById,
  pendingCompletions,
  pendingRedemptions,
  taskById,
  confirmCompletion,
  rejectCompletion,
  approveRedemption,
  rejectRedemption,
  upsertTask,
  deleteTask,
  upsertMember,
  adjustPoints,
  genId,
} from '../store/logic'
import { Card, Badge, Button, PillTabs, Modal, EmptyState } from '../components/ui'
import { IconLock, IconTrash, IconPlus } from '../components/icons'
import type { TaskRule } from '../types'

type Tab = 'checkins' | 'redemptions' | 'tasks' | 'members' | 'adjust'

export function ParentPanel() {
  const { state } = useStore()
  const [unlocked, setUnlocked] = useState(false)
  if (!unlocked) return <PinLock onUnlock={() => setUnlocked(true)} pin={state.config.parentPin} />
  return <AdminPanel />
}

// ---------- PIN 锁 ----------
function PinLock({ onUnlock, pin }: { onUnlock: () => void; pin: string }) {
  const { toast } = useStore()
  const [digits, setDigits] = useState(['', '', '', ''])
  const [shake, setShake] = useState(false)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = d
    setDigits(next)
    if (d && i < 3) refs.current[i + 1]?.focus()
  }

  const submit = () => {
    if (digits.join('') === pin) {
      onUnlock()
    } else {
      setShake(true)
      setTimeout(() => setShake(false), 400)
      setDigits(['', '', '', ''])
      refs.current[0]?.focus()
      toast('密码错误', 'error')
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className={'w-full max-w-sm p-8 text-center ' + (shake ? 'animate-[shake_0.4s]' : '')}>
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
          <IconLock width={30} height={30} />
        </div>
        <h2 className="text-xl font-extrabold text-slate-800">家长管理面板</h2>
        <p className="mt-1 text-sm text-slate-400">请输入管理密码</p>
        <div className="mt-6 flex justify-center gap-3">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (refs.current[i] = el)}
              value={d}
              inputMode="numeric"
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
                if (e.key === 'Enter') submit()
              }}
              type="password"
              className="h-14 w-12 rounded-xl border border-slate-200 text-center text-2xl font-bold text-slate-700 outline-none focus:border-indigo-400"
            />
          ))}
        </div>
        <Button className="mt-6 w-full" onClick={submit}>
          解锁
        </Button>
        <p className="mt-3 text-xs text-slate-300">管理密码：0000</p>
      </Card>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}`}</style>
    </div>
  )
}

// ---------- 管理台 ----------
function AdminPanel() {
  const [tab, setTab] = useState<Tab>('checkins')
  const { state } = useStore()
  const pendCk = pendingCompletions(state).length
  const pendRd = pendingRedemptions(state).length

  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-800">
        ⚙️ 家长管理面板
      </h1>
      <div className="overflow-x-auto">
        <PillTabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'checkins', label: `待确认打卡${pendCk ? ` (${pendCk})` : ''}` },
            { key: 'redemptions', label: `待审核兑换${pendRd ? ` (${pendRd})` : ''}` },
            { key: 'tasks', label: '任务管理' },
            { key: 'members', label: '成员管理' },
            { key: 'adjust', label: '积分调整' },
          ]}
        />
      </div>
      {tab === 'checkins' && <CheckinsTab />}
      {tab === 'redemptions' && <RedemptionsTab />}
      {tab === 'tasks' && <TasksTab />}
      {tab === 'members' && <MembersTab />}
      {tab === 'adjust' && <AdjustTab />}
    </div>
  )
}

function CheckinsTab() {
  const { state, mutate, toast } = useStore()
  const list = pendingCompletions(state)
  if (list.length === 0)
    return (
      <Card className="p-4">
        <EmptyState emoji="✅" text="暂无待确认打卡，孩子完成打卡后会显示在这里" />
      </Card>
    )
  return (
    <div className="space-y-3">
      {list.map((c) => {
        const m = memberById(state, c.memberId)
        const t = taskById(state, c.taskId)
        return (
          <Card key={c.id} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{m?.avatar}</span>
              <div>
                <div className="font-semibold text-slate-800">
                  {m?.name} · {t?.name}
                </div>
                <div className="text-xs text-slate-400">{c.submittedAt.replace('T', ' ').slice(0, 16)}</div>
              </div>
              <Badge tone="green">+{c.pointsEarned} 分</Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="success"
                onClick={() => {
                  mutate((s) => confirmCompletion(s, c.id))
                  toast(`已确认 +${c.pointsEarned} 积分`)
                }}
              >
                确认
              </Button>
              <Button
                variant="ghost"
                className="!bg-slate-100"
                onClick={() => {
                  mutate((s) => rejectCompletion(s, c.id))
                  toast('已驳回打卡', 'info')
                }}
              >
                驳回
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function RedemptionsTab() {
  const { state, mutate, toast } = useStore()
  const list = pendingRedemptions(state)
  if (list.length === 0)
    return (
      <Card className="p-4">
        <EmptyState emoji="🎁" text="暂无待审核兑换，孩子提交兑换申请后会显示在这里" />
      </Card>
    )
  return (
    <div className="space-y-3">
      {list.map((r) => {
        const m = memberById(state, r.memberId)
        return (
          <Card key={r.id} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{m?.avatar}</span>
              <div>
                <div className="font-semibold text-slate-800">
                  {m?.name} 兑换「{r.prizeName}」
                </div>
                <div className="text-xs text-slate-400">{r.createdAt.replace('T', ' ').slice(0, 16)}</div>
              </div>
              <Badge tone="rose">-{r.cost} 分</Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="success"
                onClick={() => {
                  const res = approveRedemption(state, r.id)
                  if (res.error) {
                    toast(res.error, 'error')
                    return
                  }
                  mutate(() => res.state)
                  toast(`兑换通过，扣除 ${r.cost} 积分`)
                }}
              >
                通过
              </Button>
              <Button
                variant="ghost"
                className="!bg-slate-100"
                onClick={() => {
                  mutate((s) => rejectRedemption(s, r.id))
                  toast('已驳回兑换', 'info')
                }}
              >
                驳回
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

const EMOJI_CHOICES = ['⚽', '📖', '✍️', '🔢', '📐', '📚', '🏀', '🎹', '🧹', '🍽️', '🌱', '🛏️']

function TasksTab() {
  const { state, mutate, toast } = useStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TaskRule | null>(null)

  const startNew = () => {
    setEditing({
      id: genId('t'),
      name: '',
      points: 5,
      categoryId: state.categories[0]?.id ?? '',
      emoji: '⭐',
      shared: true,
      memberId: null,
    })
    setOpen(true)
  }

  const memberName = (id: string | null) => state.members.find((m) => m.id === id)

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={startNew}>
          <IconPlus width={18} height={18} /> 新增任务
        </Button>
      </div>
      {state.tasks.map((t) => {
        const cat = state.categories.find((c) => c.id === t.categoryId)
        return (
          <Card key={t.id} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{t.emoji}</span>
              <div>
                <div className="font-semibold text-slate-800">{t.name}</div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Badge tone="indigo">{cat?.name}</Badge>
                  <span>+{t.points} 分</span>
                  {t.shared ? (
                    <Badge tone="orange">👥 共同任务</Badge>
                  ) : (
                    <Badge tone="amber">
                      {memberName(t.memberId)?.avatar} {memberName(t.memberId)?.name ?? '未指定'}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="soft"
                onClick={() => {
                  setEditing(t)
                  setOpen(true)
                }}
              >
                编辑
              </Button>
              <Button
                variant="ghost"
                className="!text-rose-500 hover:!bg-rose-50"
                onClick={() => {
                  mutate((s) => deleteTask(s, t.id))
                  toast('任务已删除', 'info')
                }}
              >
                <IconTrash width={16} height={16} />
              </Button>
            </div>
          </Card>
        )
      })}

      <Modal
        open={open && !!editing}
        onClose={() => setOpen(false)}
        title={state.tasks.some((t) => t.id === editing?.id) ? '编辑任务' : '新增任务'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (!editing || !editing.name.trim()) {
                  toast('请填写任务名称', 'error')
                  return
                }
                if (!editing.shared && !editing.memberId) {
                  toast('请指定归属孩子，或勾选共同任务', 'error')
                  return
                }
                // 归一化：共同任务不保留具体成员
                mutate((s) => upsertTask(s, { ...editing, memberId: editing.shared ? null : editing.memberId }))
                setOpen(false)
                toast('任务已保存')
              }}
            >
              保存
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <Field label="任务名称">
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                placeholder="如：整理房间"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="积分">
                <input
                  type="number"
                  value={editing.points}
                  onChange={(e) => setEditing({ ...editing, points: parseInt(e.target.value, 10) || 0 })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
              </Field>
              <Field label="分类">
                <select
                  value={editing.categoryId}
                  onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                >
                  {state.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="图标">
              <div className="flex flex-wrap gap-2">
                {EMOJI_CHOICES.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEditing({ ...editing, emoji: e })}
                    className={
                      'flex h-9 w-9 items-center justify-center rounded-lg border text-lg ' +
                      (editing.emoji === e ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200')
                    }
                  >
                    {e}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="任务归属">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing({ ...editing, shared: true, memberId: null })}
                    className={
                      'flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ' +
                      (editing.shared
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                        : 'border-slate-200 text-slate-500')
                    }
                  >
                    👥 共同任务
                  </button>
                  <button
                    onClick={() =>
                      setEditing({
                        ...editing,
                        shared: false,
                        memberId: editing.memberId ?? state.members[0]?.id ?? null,
                      })
                    }
                    className={
                      'flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ' +
                      (!editing.shared
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                        : 'border-slate-200 text-slate-500')
                    }
                  >
                    👤 指定孩子
                  </button>
                </div>
                {editing.shared ? (
                  <p className="text-xs text-slate-400">全体成员都要完成这项任务</p>
                ) : (
                  <select
                    value={editing.memberId ?? ''}
                    onChange={(e) => setEditing({ ...editing, memberId: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  >
                    {state.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.avatar} {m.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </Field>
          </div>
        )}
      </Modal>
    </div>
  )
}

const AVATAR_CHOICES = ['🦁', '🐯', '🐶', '🐱', '🐰', '🐻', '🐼', '🦊', '🐨', '🐵']

function MembersTab() {
  const { state, mutate, toast } = useStore()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('🐶')

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <IconPlus width={18} height={18} /> 新增成员
        </Button>
      </div>
      {state.members.map((m) => (
        <Card key={m.id} className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{m.avatar}</span>
            <div className="font-semibold text-slate-800">{m.name}</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {AVATAR_CHOICES.slice(0, 6).map((a) => (
              <button
                key={a}
                onClick={() => {
                  mutate((s) => upsertMember(s, { ...m, avatar: a }))
                  toast('头像已更新')
                }}
                className={
                  'flex h-8 w-8 items-center justify-center rounded-lg border text-base ' +
                  (m.avatar === a ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200')
                }
              >
                {a}
              </button>
            ))}
          </div>
        </Card>
      ))}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="新增家庭成员"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (!name.trim()) {
                  toast('请填写姓名', 'error')
                  return
                }
                mutate((s) => upsertMember(s, { id: genId('m'), name: name.trim(), avatar }))
                setName('')
                setAvatar('🐶')
                setOpen(false)
                toast('成员已添加')
              }}
            >
              保存
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="姓名">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              placeholder="如：陶小小"
            />
          </Field>
          <Field label="头像">
            <div className="flex flex-wrap gap-2">
              {AVATAR_CHOICES.map((a) => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  className={
                    'flex h-10 w-10 items-center justify-center rounded-lg border text-xl ' +
                    (avatar === a ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200')
                  }
                >
                  {a}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Modal>
    </div>
  )
}

function AdjustTab() {
  const { state, mutate, toast } = useStore()
  const [memberId, setMemberId] = useState(state.currentMemberId)
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')

  const submit = () => {
    const p = parseInt(points, 10)
    if (!Number.isFinite(p) || p === 0) {
      toast('请输入非零积分', 'error')
      return
    }
    mutate((s) => adjustPoints(s, memberId, p, reason.trim() || '积分调整'))
    setPoints('')
    setReason('')
    toast(`已${p > 0 ? '奖励' : '扣除'} ${Math.abs(p)} 积分`)
  }

  return (
    <Card className="max-w-lg p-6">
      <h2 className="text-lg font-bold text-slate-800">手动调整积分</h2>
      <p className="mt-1 text-sm text-slate-400">正数奖励，负数扣除。调整会记入积分明细。</p>
      <div className="mt-5 space-y-4">
        <Field label="成员">
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          >
            {state.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.avatar} {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="积分（正数奖励，负数扣除）">
          <input
            type="number"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            placeholder="如：10 或 -5"
          />
        </Field>
        <Field label="原因">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            placeholder="如：额外表现奖励"
          />
        </Field>
        <Button className="w-full" onClick={submit}>
          确认调整
        </Button>
      </div>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-600">{label}</label>
      {children}
    </div>
  )
}
