import type {
  AppState,
  Completion,
  LedgerEntry,
  Member,
  MemberId,
  Prize,
  Redemption,
  TaskRule,
  TaskId,
  LedgerTag,
} from '../types'
import { todayStr } from '../data/constants'
import { diffDays } from '../lib/date'

// ---------- 工具 ----------

let _counter = 0
export function genId(prefix: string): string {
  _counter += 1
  return `${prefix}_${Date.now().toString(36)}${_counter.toString(36)}`
}

function dateOf(iso: string): string {
  return iso.slice(0, 10)
}

/** 判断 ISO 时间是否落在最近 7 天（含今天，基于 APP_TODAY） */
export function isThisWeek(iso: string): boolean {
  const diff = diffDays(todayStr(), dateOf(iso))
  return diff >= 0 && diff < 7
}

function isThisMonth(iso: string): boolean {
  return iso.slice(0, 7) === todayStr().slice(0, 7)
}

export type Period = 'week' | 'month'
export function inPeriod(iso: string, period: Period): boolean {
  return period === 'week' ? isThisWeek(iso) : isThisMonth(iso)
}

// ---------- 选择器（纯读） ----------

export function memberById(state: AppState, id: MemberId): Member | undefined {
  return state.members.find((m) => m.id === id)
}

export function taskById(state: AppState, id: TaskId): TaskRule | undefined {
  return state.tasks.find((t) => t.id === id)
}

/** 成员当前总分 = 其所有流水之和 */
export function memberTotal(state: AppState, memberId: MemberId): number {
  return state.ledger
    .filter((l) => l.memberId === memberId)
    .reduce((sum, l) => sum + l.points, 0)
}

/** 今日积分 = 今天「任务所得」正向流水之和 */
export function todayEarned(state: AppState, memberId: MemberId): number {
  return state.ledger
    .filter(
      (l) =>
        l.memberId === memberId &&
        l.tag === '任务所得' &&
        l.points > 0 &&
        dateOf(l.createdAt) === todayStr(),
    )
    .reduce((sum, l) => sum + l.points, 0)
}

/** 待审核兑换占用（预留）的积分：所有 pending 申请的 cost 之和 */
export function pendingReserved(state: AppState, memberId: MemberId): number {
  return state.redemptions
    .filter((r) => r.memberId === memberId && r.status === 'pending')
    .reduce((sum, r) => sum + r.cost, 0)
}

/** 可支配余额 = 总分 − 待审占用。发起新兑换以此为准，防止多笔待审叠加透支。 */
export function availableBalance(state: AppState, memberId: MemberId): number {
  return memberTotal(state, memberId) - pendingReserved(state, memberId)
}

/** 某成员适用的任务：共同任务对全员生效，或明确指派给该成员的任务 */
export function applicableTasks(state: AppState, memberId: MemberId): TaskRule[] {
  return state.tasks.filter((t) => t.shared || t.memberId === memberId)
}

/** 某成员今天对某任务的打卡状态 */
export function completionStatusFor(
  state: AppState,
  memberId: MemberId,
  taskId: TaskId,
): 'none' | 'pending' | 'confirmed' {
  const cp = state.completions.find(
    (c) => c.memberId === memberId && c.taskId === taskId && c.date === todayStr(),
  )
  return cp ? cp.status : 'none'
}

/** 今日打卡进度（已确认口径） */
export function todayProgress(
  state: AppState,
  memberId: MemberId,
): { done: number; total: number; rate: number } {
  const total = applicableTasks(state, memberId).length
  const done = state.completions.filter(
    (c) => c.memberId === memberId && c.date === todayStr() && c.status === 'confirmed',
  ).length
  // 夹紧 ≤100%：done 含已归档任务的历史完成，删任务后 done 可能超过 total，避免进度条溢出
  const rate = total === 0 ? 0 : Math.min(100, Math.round((done / total) * 100))
  return { done, total, rate }
}

/** 某成员今日打卡次数（含待确认） */
export function todayCheckinCount(state: AppState, memberId: MemberId): number {
  return state.completions.filter(
    (c) => c.memberId === memberId && c.date === todayStr(),
  ).length
}

/** 待确认打卡列表 */
export function pendingCompletions(state: AppState): Completion[] {
  return state.completions.filter((c) => c.status === 'pending')
}

/** 待审核兑换列表 */
export function pendingRedemptions(state: AppState): Redemption[] {
  return state.redemptions.filter((r) => r.status === 'pending')
}

/** 某实物心愿的当前状态：available / pending / approved / rejected */
export function prizeStatus(
  state: AppState,
  prizeId: string,
): 'available' | 'pending' | 'approved' | 'rejected' {
  const reds = state.redemptions
    .filter((r) => r.prizeId === prizeId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return reds.length ? reds[0].status : 'available'
}

/** 某成员的实物心愿 */
export function memberWishes(state: AppState, memberId: MemberId): Prize[] {
  return state.prizes.filter((p) => p.kind === 'physical' && p.memberId === memberId)
}

/** 某成员当前「可兑换」的实物心愿（未处于兑换流程中且可支配余额足够） */
export function redeemableWishes(state: AppState, memberId: MemberId): Prize[] {
  const balance = availableBalance(state, memberId)
  return memberWishes(state, memberId).filter(
    (p) => prizeStatus(state, p.id) === 'available' && balance >= p.cost,
  )
}

/** 虚拟奖励列表 */
export function virtualRewards(state: AppState): Prize[] {
  return state.prizes.filter((p) => p.kind === 'virtual')
}

/** 某虚拟奖励对某成员可兑换次数 = floor(可支配余额 / 每次消耗) */
export function redeemableCount(state: AppState, memberId: MemberId, prize: Prize): number {
  if (prize.cost <= 0) return 0
  return Math.max(0, Math.floor(availableBalance(state, memberId) / prize.cost))
}

// ---------- 操作（纯变换，返回新 state） ----------

function withState(state: AppState, patch: Partial<AppState>): AppState {
  return { ...state, ...patch }
}

function addLedger(
  state: AppState,
  memberId: MemberId,
  points: number,
  tag: LedgerTag,
  description: string,
): AppState {
  // 时间戳的日期锚定 APP_TODAY，时钟用真实时间以保证排序
  const entry: LedgerEntry = {
    id: genId('l'),
    memberId,
    points,
    tag,
    description,
    createdAt: `${todayStr()}T${nowClock()}`,
  }
  return withState(state, { ledger: [entry, ...state.ledger] })
}

function nowClock(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 孩子打卡 → 生成「待确认」记录（不立即加分） */
export function checkInTask(state: AppState, memberId: MemberId, taskId: TaskId): AppState {
  if (completionStatusFor(state, memberId, taskId) !== 'none') return state
  const task = taskById(state, taskId)
  if (!task) return state
  const cp: Completion = {
    id: genId('cp'),
    taskId,
    memberId,
    date: todayStr(),
    status: 'pending',
    pointsEarned: task.points,
    submittedAt: `${todayStr()}T${nowClock()}`,
  }
  return withState(state, { completions: [...state.completions, cp] })
}

/** 撤销一条待确认打卡 */
export function undoCheckIn(state: AppState, completionId: string): AppState {
  const cp = state.completions.find((c) => c.id === completionId)
  if (!cp || cp.status !== 'pending') return state
  return withState(state, {
    completions: state.completions.filter((c) => c.id !== completionId),
  })
}

/** 家长确认打卡 → 记为已确认并入账加分 */
export function confirmCompletion(state: AppState, completionId: string): AppState {
  const cp = state.completions.find((c) => c.id === completionId)
  if (!cp || cp.status !== 'pending') return state
  const next = withState(state, {
    completions: state.completions.map((c) =>
      c.id === completionId ? { ...c, status: 'confirmed' } : c,
    ),
  })
  const task = taskById(state, cp.taskId)
  return addLedger(next, cp.memberId, cp.pointsEarned, '任务所得', `完成打卡：${task?.name ?? ''}`)
}

/** 家长驳回打卡 → 删除该待确认记录 */
export function rejectCompletion(state: AppState, completionId: string): AppState {
  return undoCheckIn(state, completionId)
}

/** 孩子申请兑换 → 生成待审核申请（暂不扣分） */
export function requestRedemption(
  state: AppState,
  memberId: MemberId,
  prizeId: string,
): { state: AppState; error?: string } {
  const prize = state.prizes.find((p) => p.id === prizeId)
  if (!prize) return { state, error: '奖品不存在' }
  // 以「可支配余额」判定：已有待审申请会占用额度，防止多笔待审叠加透支
  if (availableBalance(state, memberId) < prize.cost) return { state, error: '积分不足' }
  const rd: Redemption = {
    id: genId('rd'),
    prizeId,
    prizeName: prize.name,
    memberId,
    cost: prize.cost,
    status: 'pending',
    createdAt: `${todayStr()}T${nowClock()}`,
  }
  return { state: withState(state, { redemptions: [rd, ...state.redemptions] }) }
}

/** 家长通过兑换 → 扣分入账。审批时重新复核余额，防止批准前余额被其它操作抽走导致透支。 */
export function approveRedemption(
  state: AppState,
  redemptionId: string,
): { state: AppState; error?: string } {
  const rd = state.redemptions.find((r) => r.id === redemptionId)
  if (!rd || rd.status !== 'pending') return { state }
  // 复核用「总分」而非可支配余额：本笔自身占用要计入，其它待审不阻止本笔扣分
  const spendable = memberTotal(state, rd.memberId)
  if (spendable < rd.cost) return { state, error: '积分不足，无法通过兑换' }
  const next = withState(state, {
    redemptions: state.redemptions.map((r) =>
      r.id === redemptionId ? { ...r, status: 'approved' } : r,
    ),
  })
  return { state: addLedger(next, rd.memberId, -rd.cost, '兑换', `兑换奖品：${rd.prizeName}`) }
}

/** 家长驳回兑换 */
export function rejectRedemption(state: AppState, redemptionId: string): AppState {
  return withState(state, {
    redemptions: state.redemptions.map((r) =>
      r.id === redemptionId ? { ...r, status: 'rejected' } : r,
    ),
  })
}

/** 家长手动调整积分（正数奖励 / 负数扣除） */
export function adjustPoints(
  state: AppState,
  memberId: MemberId,
  points: number,
  description: string,
): AppState {
  if (points === 0) return state
  return addLedger(state, memberId, points, '调整', description || '积分调整')
}

// ---- 任务管理 ----
export function upsertTask(state: AppState, task: TaskRule): AppState {
  const exists = state.tasks.some((t) => t.id === task.id)
  return withState(state, {
    tasks: exists ? state.tasks.map((t) => (t.id === task.id ? task : t)) : [...state.tasks, task],
  })
}
export function deleteTask(state: AppState, taskId: TaskId): AppState {
  return withState(state, { tasks: state.tasks.filter((t) => t.id !== taskId) })
}

// ---- 心愿管理 ----
export function addWish(
  state: AppState,
  memberId: MemberId,
  name: string,
  cost: number,
  emoji = '🎁',
): AppState {
  const prize: Prize = { id: genId('p'), kind: 'physical', name, emoji, cost, memberId }
  return withState(state, { prizes: [...state.prizes, prize] })
}
export function deletePrize(state: AppState, prizeId: string): AppState {
  return withState(state, {
    prizes: state.prizes.filter((p) => p.id !== prizeId),
    redemptions: state.redemptions.filter((r) => r.prizeId !== prizeId),
  })
}

// ---- 成员管理 ----
export function upsertMember(state: AppState, member: Member): AppState {
  const exists = state.members.some((m) => m.id === member.id)
  return withState(state, {
    members: exists
      ? state.members.map((m) => (m.id === member.id ? member : m))
      : [...state.members, member],
  })
}

export function switchMember(state: AppState, memberId: MemberId): AppState {
  return withState(state, { currentMemberId: memberId })
}
