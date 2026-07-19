import type { AppState, MemberId } from '../types'
import { taskById } from './logic'
import { CHART_COLORS, shortDate, todayStr } from '../data/constants'
import { addDays, diffDays, sameMonth, weekdayIndex } from '../lib/date'

export type Period = 'week' | 'month'

function dateInPeriod(date: string, period: Period): boolean {
  const today = todayStr()
  if (period === 'month') return sameMonth(date, today)
  const diff = diffDays(today, date)
  return diff >= 0 && diff < 7
}

/** 统计概览四项 */
export function statSummary(state: AppState, memberId: MemberId, period: Period) {
  const total = state.ledger
    .filter((l) => l.memberId === memberId)
    .reduce((s, l) => s + l.points, 0)
  const completions = state.completions.filter(
    (c) => c.memberId === memberId && c.status === 'confirmed' && dateInPeriod(c.date, period),
  ).length
  const pending = state.completions.filter(
    (c) => c.memberId === memberId && c.status === 'pending',
  ).length
  const rejected = state.redemptions.filter(
    (r) => r.memberId === memberId && r.status === 'rejected' && dateInPeriod(r.createdAt.slice(0, 10), period),
  ).length
  return { total, completions, pending, rejected }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** 每周完成情况：本周 Sun–Sat 每天已确认打卡数 */
export function weeklyBars(state: AppState, memberId: MemberId): { day: string; count: number }[] {
  const today = todayStr()
  const sunday = addDays(today, -weekdayIndex(today))
  return WEEKDAYS.map((day, i) => {
    const ds = addDays(sunday, i)
    const count = state.completions.filter(
      (c) => c.memberId === memberId && c.status === 'confirmed' && c.date === ds,
    ).length
    return { day, count }
  })
}

/** 任务类别分布（按已确认打卡的任务分类计数） */
export function categoryDistribution(
  state: AppState,
  memberId: MemberId,
  period: Period,
): { name: string; value: number; color: string }[] {
  const counts = new Map<string, number>()
  for (const c of state.completions) {
    if (c.memberId !== memberId || c.status !== 'confirmed' || !dateInPeriod(c.date, period)) continue
    const task = taskById(state, c.taskId)
    if (!task) continue
    counts.set(task.categoryId, (counts.get(task.categoryId) ?? 0) + 1)
  }
  return state.categories
    .filter((cat) => counts.has(cat.id))
    .map((cat, i) => ({
      name: cat.name,
      value: counts.get(cat.id)!,
      color: CHART_COLORS.donut[i % CHART_COLORS.donut.length],
    }))
}

/** 积分趋势：最近 7 天每日净积分 */
export function pointsTrend(state: AppState, memberId: MemberId): { date: string; points: number }[] {
  const out: { date: string; points: number }[] = []
  const today = todayStr()
  for (let i = 6; i >= 0; i--) {
    const ds = addDays(today, -i)
    const points = state.ledger
      .filter((l) => l.memberId === memberId && l.createdAt.slice(0, 10) === ds)
      .reduce((s, l) => s + l.points, 0)
    out.push({ date: shortDate(ds), points })
  }
  return out
}
