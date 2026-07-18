import { useState } from 'react'
import { useStore } from '../store/StoreContext'
import {
  memberById,
  memberTotal,
  memberWishes,
  virtualRewards,
  redeemableCount,
  prizeStatus,
  requestRedemption,
  addWish,
} from '../store/logic'
import { Card, Badge, Button, PillTabs, Modal, EmptyState } from '../components/ui'
import { MemberChips } from '../components/MemberChips'
import { IconPlus } from '../components/icons'
import type { Prize } from '../types'

export function Prizes() {
  const { state, mutate, toast } = useStore()
  const member = memberById(state, state.currentMemberId)!
  const total = memberTotal(state, member.id)
  const [tab, setTab] = useState<'physical' | 'virtual'>('physical')
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [cost, setCost] = useState('')

  const wishes = memberWishes(state, member.id)
  const virtuals = virtualRewards(state)

  const redeem = (prize: Prize) => {
    const r = requestRedemption(state, member.id, prize.id)
    if (r.error) {
      toast(r.error, 'error')
      return
    }
    mutate(() => r.state)
    toast('兑换申请已提交，请等待家长确认！')
  }

  const submitWish = () => {
    const c = parseInt(cost, 10)
    if (!name.trim() || !Number.isFinite(c) || c <= 0) {
      toast('请填写心愿名称与所需积分', 'error')
      return
    }
    mutate((s) => addWish(s, member.id, name.trim(), c))
    setName('')
    setCost('')
    setAddOpen(false)
    toast('心愿已添加')
  }

  return (
    <div className="space-y-5">
      {/* 页头 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-800">
            🎁 心愿奖品池
          </h1>
          <MemberChips />
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <IconPlus width={18} height={18} /> 添加心愿
        </Button>
      </div>

      {/* 渐变积分横幅 */}
      <div className="flex items-center justify-between overflow-hidden rounded-2xl bg-brand-gradient px-6 py-6 text-white shadow-card">
        <div className="flex items-center gap-4">
          <span className="text-4xl drop-shadow">{member.avatar}</span>
          <div>
            <div className="text-sm/relaxed opacity-90">{member.name} 的当前积分</div>
            <div className="text-4xl font-extrabold">{total}</div>
          </div>
        </div>
        <div className="hidden text-sm font-medium opacity-90 sm:block">
          继续加油完成任务赚取更多积分吧！
        </div>
      </div>

      {/* tab */}
      <div className="flex justify-center">
        <PillTabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'physical', label: '实物奖品' },
            { key: 'virtual', label: '虚拟奖励' },
          ]}
        />
      </div>

      {/* 实物奖品 */}
      {tab === 'physical' &&
        (wishes.length === 0 ? (
          <Card className="p-6">
            <EmptyState emoji="🎁" text="还没有心愿奖品，点击右上角添加你的第一个心愿吧" />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {wishes.map((p) => {
              const status = prizeStatus(state, p.id)
              const affordable = total >= p.cost
              return (
                <Card key={p.id} className="flex flex-col p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{p.emoji}</span>
                      <span className="font-bold text-slate-800">{p.name}</span>
                    </div>
                    {status === 'rejected' && <Badge tone="rose">⊘ 已拒绝</Badge>}
                    {status === 'approved' && <Badge tone="green">✅ 已兑换</Badge>}
                    {status === 'pending' && <Badge tone="orange">待确认</Badge>}
                  </div>
                  <div className="mt-4 text-lg font-bold text-indigo-600">{p.cost} 积分</div>
                  <div className="mt-auto pt-4">
                    {status === 'available' ? (
                      <Button
                        className="w-full"
                        disabled={!affordable}
                        onClick={() => redeem(p)}
                      >
                        {affordable ? '兑换实物' : '积分不足'}
                      </Button>
                    ) : (
                      <Button variant="ghost" className="w-full !bg-slate-100" disabled>
                        {status === 'rejected' ? '已被驳回' : status === 'approved' ? '已兑换' : '审核中'}
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        ))}

      {/* 虚拟奖励 */}
      {tab === 'virtual' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {virtuals.map((v) => {
            const count = redeemableCount(state, member.id, v)
            return (
              <Card key={v.id} className="flex flex-col p-5">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{v.emoji}</span>
                  <span className="font-bold text-slate-800">{v.name}</span>
                </div>
                <div className="mt-2 text-sm text-slate-400">
                  兑换价值：{v.rewardValue}
                </div>
                <div className="mt-3 text-sm text-slate-500">
                  可兑换 <span className="font-bold text-indigo-600">{count}</span> 次（每次 {v.cost} 积分）
                </div>
                <div className="mt-auto pt-4">
                  <Button className="w-full" disabled={count <= 0} onClick={() => redeem(v)}>
                    {count > 0 ? '兑换' : '积分不足'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* 添加心愿弹框 */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="添加心愿奖品"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button onClick={submitWish}>保存</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">心愿名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：新的乐高积木"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">所需积分</label>
            <input
              type="number"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="如：50"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
