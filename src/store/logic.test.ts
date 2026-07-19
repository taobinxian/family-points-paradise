import assert from 'node:assert/strict'
import { addDays, diffDays, weekdayIndex, weekdayLabel, shortLabel } from '../lib/date'
import { weeklyBars, statSummary } from './stats'
import { __setTodayForTest, todayStr, daysAgo } from '../data/constants'
import { createSeedState } from '../data/seed'

// 固定"今天"以获得确定性（否则种子按真实日期生成，断言随运行日漂移）
__setTodayForTest('2026-07-18')
import {
  memberTotal,
  todayEarned,
  todayProgress,
  applicableTasks,
  completionStatusFor,
  checkInTask,
  undoCheckIn,
  confirmCompletion,
  rejectCompletion,
  requestRedemption,
  approveRedemption,
  rejectRedemption,
  adjustPoints,
  redeemableCount,
  redeemableWishes,
  availableBalance,
  pendingReserved,
  pendingCompletions,
  pendingRedemptions,
  prizeStatus,
  virtualRewards,
  addWish,
  upsertTask,
  deleteTask,
} from './logic'
import type { AppState } from '../types'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

// 意图：种子状态必须复现原站首页头部数字（这是复刻的验收基线）
test('种子数据复现原站首页头部数字', () => {
  const s = createSeedState()
  assert.equal(memberTotal(s, 'm_rk'), 25, '陶睿楷总分应为 25')
  assert.equal(memberTotal(s, 'm_yy'), 15, '陶悠杨总分应为 15')
  assert.equal(todayEarned(s, 'm_rk'), 25, '陶睿楷今日积分应为 +25')
  assert.equal(todayEarned(s, 'm_yy'), 15, '陶悠杨今日积分应为 +15')
  const prog = todayProgress(s, 'm_rk')
  assert.equal(prog.done, 4, '今日完成应为 4')
  assert.equal(prog.total, 5, '任务总数应为 5')
  assert.equal(prog.rate, 80, '完成率应为 80%')
})

// 意图：陶睿楷 3 个心愿全被拒 → 无可兑换 → 首页心愿单为空（对齐截图）
test('陶睿楷心愿全部已拒绝，可兑换心愿为空', () => {
  const s = createSeedState()
  assert.equal(redeemableWishes(s, 'm_rk').length, 0)
  assert.equal(prizeStatus(s, 'p_money'), 'rejected')
})

// 意图：虚拟奖励「每次 1 分」→ 25 分可兑 25 次（对齐首页「可兑换 25 次」）
test('虚拟奖励可兑换次数 = 总分 / 每次消耗', () => {
  const s = createSeedState()
  const vGame = virtualRewards(s).find((p) => p.id === 'v_game')!
  assert.equal(redeemableCount(s, 'm_rk', vGame), 25)
})

// 意图：打卡是「先申请后确认」两段式，未确认前不得加分（家长审核语义）
test('打卡先进入待确认、家长确认后才加分', () => {
  let s: AppState = createSeedState()
  // 背诗一首是陶睿楷今天唯一未打卡的任务
  assert.equal(completionStatusFor(s, 'm_rk', 't_poem'), 'none')
  const before = memberTotal(s, 'm_rk')

  s = checkInTask(s, 'm_rk', 't_poem')
  assert.equal(completionStatusFor(s, 'm_rk', 't_poem'), 'pending', '应变为待确认')
  assert.equal(memberTotal(s, 'm_rk'), before, '待确认阶段不加分')
  assert.equal(pendingCompletions(s).length, 1)

  const pendingId = pendingCompletions(s)[0].id
  s = confirmCompletion(s, pendingId)
  assert.equal(completionStatusFor(s, 'm_rk', 't_poem'), 'confirmed')
  assert.equal(memberTotal(s, 'm_rk'), before + 10, '确认后加 10 分（背诗一首）')
  assert.equal(todayProgress(s, 'm_rk').done, 5, '完成数变为 5')
})

// 意图：重复打卡同一任务应幂等，不产生第二条记录
test('同一任务当天重复打卡幂等', () => {
  let s = createSeedState()
  s = checkInTask(s, 'm_rk', 't_poem')
  s = checkInTask(s, 'm_rk', 't_poem')
  assert.equal(pendingCompletions(s).length, 1)
})

// 意图：撤销/驳回待确认打卡不应影响积分
test('撤销与驳回待确认打卡', () => {
  let s = createSeedState()
  s = checkInTask(s, 'm_rk', 't_poem')
  const id = pendingCompletions(s)[0].id
  const undone = undoCheckIn(s, id)
  assert.equal(pendingCompletions(undone).length, 0)
  const rejected = rejectCompletion(s, id)
  assert.equal(pendingCompletions(rejected).length, 0)
})

// 意图：兑换是两段式，通过后才扣分；驳回不扣分
test('兑换先申请、通过后扣分、驳回不扣分', () => {
  let s = createSeedState()
  const before = memberTotal(s, 'm_rk')
  const vGame = virtualRewards(s).find((p) => p.id === 'v_game')!

  const r = requestRedemption(s, 'm_rk', vGame.id)
  assert.equal(r.error, undefined)
  s = r.state
  assert.equal(memberTotal(s, 'm_rk'), before, '申请阶段不扣分')
  assert.equal(pendingRedemptions(s).length, 1)

  const rid = pendingRedemptions(s)[0].id
  const approved = approveRedemption(s, rid)
  assert.equal(approved.error, undefined)
  assert.equal(memberTotal(approved.state, 'm_rk'), before - 1, '通过后扣 1 分')

  const rejected = rejectRedemption(s, rid)
  assert.equal(memberTotal(rejected, 'm_rk'), before, '驳回不扣分')
})

// —— 以下为代码审查发现的 Critical（兑换双花/积分变负）回归 ——

// 意图：多笔待审兑换必须占用可支配余额，不能叠加透支（防双花）
test('待审兑换占用可支配余额，第二笔透支被拒', () => {
  let s = createSeedState()
  // 陶睿楷 25 分；加两个各 20 分的可负担心愿
  s = addWish(s, 'm_rk', '愿望A', 20)
  s = addWish(s, 'm_rk', '愿望B', 20)
  const [wa, wb] = s.prizes.filter((p) => p.name === '愿望A' || p.name === '愿望B')
  const r1 = requestRedemption(s, 'm_rk', wa.id)
  assert.equal(r1.error, undefined, '第一笔 20 应通过（余额 25）')
  s = r1.state
  assert.equal(pendingReserved(s, 'm_rk'), 20)
  assert.equal(availableBalance(s, 'm_rk'), 5)
  const r2 = requestRedemption(s, 'm_rk', wb.id)
  assert.equal(r2.error, '积分不足', '第二笔 20 应被拒（可支配仅剩 5）')
})

// 意图：审批时必须复核余额；批准前余额被抽走则拒绝通过，绝不把总分做成负数
test('审批时复核余额，余额被抽走则拒绝通过', () => {
  let s = createSeedState()
  s = addWish(s, 'm_rk', '愿望C', 20)
  const wc = s.prizes.find((p) => p.name === '愿望C')!
  s = requestRedemption(s, 'm_rk', wc.id).state
  // 家长在批准前先扣 10（如手动调整），总分 25→15
  s = adjustPoints(s, 'm_rk', -10, '临时扣分')
  const rid = pendingRedemptions(s)[0].id
  const res = approveRedemption(s, rid)
  assert.equal(res.error, '积分不足，无法通过兑换', '余额 15 < 20，应拒绝通过')
  assert.equal(memberTotal(res.state, 'm_rk'), 15, '总分保持 15，不得变负')
})

// 意图：核心不变量——任何合法操作序列后，成员总分都不得为负
test('不变量：任何操作序列后总分不为负', () => {
  let s = createSeedState()
  const vGame = virtualRewards(s).find((p) => p.id === 'v_game')! // cost 1
  // 反复申请虚拟奖励：预留模型下最多能申请到可支配余额耗尽（25 笔）
  let approvedCount = 0
  for (let i = 0; i < 40; i++) {
    const r = requestRedemption(s, 'm_rk', vGame.id)
    if (r.error) continue
    s = r.state
  }
  assert.equal(pendingRedemptions(s).length, 25, '最多 25 笔待审（每笔占 1，余额 25）')
  // 全部通过
  for (const rd of pendingRedemptions(s)) {
    const res = approveRedemption(s, rd.id)
    s = res.state
    if (!res.error) approvedCount += 1
  }
  assert.equal(approvedCount, 25)
  assert.equal(memberTotal(s, 'm_rk'), 0, '25 分领 25 次，恰好归零')
  assert.ok(memberTotal(s, 'm_rk') >= 0, '总分绝不为负')
})

// 意图：积分不足时不能发起兑换
test('积分不足拒绝兑换申请', () => {
  const s = createSeedState()
  // 人民币10元 需 100 分，陶睿楷只有 25
  const r = requestRedemption(s, 'm_rk', 'p_money')
  assert.equal(r.error, '积分不足')
})

// 意图：家长调整积分正负都入账，且体现在总分
test('家长调整积分正负入账', () => {
  let s = createSeedState()
  const before = memberTotal(s, 'm_rk')
  s = adjustPoints(s, 'm_rk', 20, '额外奖励')
  assert.equal(memberTotal(s, 'm_rk'), before + 20)
  s = adjustPoints(s, 'm_rk', -5, '扣分')
  assert.equal(memberTotal(s, 'm_rk'), before + 15)
})

// 意图：新增心愿在积分足够时应变为可兑换
test('新增可负担心愿后变为可兑换', () => {
  let s = createSeedState()
  s = addWish(s, 'm_rk', '小贴纸', 10, '⭐')
  const wishes = redeemableWishes(s, 'm_rk')
  assert.equal(wishes.length, 1)
  assert.equal(wishes[0].name, '小贴纸')
})

// 意图：任务增删改维护任务集
test('任务增删改', () => {
  let s = createSeedState()
  s = upsertTask(s, { id: 't_new', name: '洗碗', points: 5, categoryId: 'c_study', emoji: '🍽️', shared: true, memberId: null })
  assert.equal(s.tasks.length, 6)
  s = upsertTask(s, { id: 't_new', name: '洗碗筷', points: 8, categoryId: 'c_study', emoji: '🍽️', shared: true, memberId: null })
  assert.equal(s.tasks.find((t) => t.id === 't_new')!.points, 8)
  s = deleteTask(s, 't_new')
  assert.equal(s.tasks.length, 5)
})

// 意图：任务可指定归属——共同任务对全员生效，指派任务只归目标孩子
test('任务归属：共同任务全员可见，指派任务仅目标孩子可见', () => {
  let s = createSeedState()
  // 给陶悠杨(m_yy)单独指派一个任务
  s = upsertTask(s, {
    id: 't_yy_only', name: '练钢琴', points: 8, categoryId: 'c_study', emoji: '🎹', shared: false, memberId: 'm_yy',
  })
  const yyTasks = applicableTasks(s, 'm_yy').map((t) => t.id)
  const rkTasks = applicableTasks(s, 'm_rk').map((t) => t.id)
  assert.ok(yyTasks.includes('t_yy_only'), '陶悠杨能看到指派给自己的任务')
  assert.ok(!rkTasks.includes('t_yy_only'), '陶睿楷看不到指派给陶悠杨的任务')
  // 共同任务两人都能看到
  assert.ok(yyTasks.includes('t_run') && rkTasks.includes('t_run'), '共同任务全员可见')
  // 指派任务不影响陶睿楷的今日应做总数（仍是 5 项共同任务）
  assert.equal(applicableTasks(s, 'm_rk').length, 5)
  assert.equal(applicableTasks(s, 'm_yy').length, 6)
})

// 意图：日期算法必须时区无关（曾因「本地构造+toISOString(UTC)」在 UTC+8 下 off-by-one）
test('日期工具时区安全', () => {
  // 2026-07-18 是周六(6)；前一天必须是 07-17 而非 07-16（旧 bug）
  assert.equal(addDays('2026-07-18', -1), '2026-07-17')
  assert.equal(addDays('2026-07-18', -8), '2026-07-10')
  assert.equal(addDays('2026-07-18', 1), '2026-07-19')
  assert.equal(weekdayIndex('2026-07-18'), 6)
  assert.equal(weekdayLabel('2026-07-18'), 'Sat')
  assert.equal(weekdayLabel('2026-07-17'), 'Fri')
  assert.equal(diffDays('2026-07-18', '2026-07-17'), 1)
  assert.equal(diffDays('2026-07-18', '2026-07-11'), 7)
  assert.equal(shortLabel('2026-07-18'), '7/18')
})

// 意图：种子数据的昨日完成必须落在 07-17，且每周柱状图呈现 周五1 / 周六4（对齐原站统计页形态）
test('种子昨日日期正确，每周柱状图 周五1 周六4', () => {
  const s = createSeedState()
  const yday = s.completions.find((c) => c.id === 'cp7')!
  assert.equal(yday.date, '2026-07-17', '昨日完成应为 07-17')
  const bars = weeklyBars(s, 'm_rk')
  const byDay = Object.fromEntries(bars.map((b) => [b.day, b.count]))
  assert.equal(byDay['Sat'], 4, '周六(今日)应有 4 次完成')
  assert.equal(byDay['Fri'], 1, '周五(昨日)应有 1 次完成')
  const summary = statSummary(s, 'm_rk', 'week')
  assert.equal(summary.completions, 5, '本周完成次数应为 5')
  assert.equal(summary.rejected, 0, '本周已驳回应为 0（驳回申请在 8 天前）')
})

// 意图：每日刷新 —— 跨天后今日打卡清单归零、往日打卡进历史、累计总分不变、新打卡记到新日期
test('每日刷新：跨天后今日进度归零，往日打卡进历史', () => {
  const s = createSeedState() // 在 2026-07-18 生成，当天 4/5
  assert.equal(todayProgress(s, 'm_rk').done, 4, '种子当天今日完成 4')
  assert.equal(todayEarned(s, 'm_rk'), 25, '种子当天今日积分 25')

  __setTodayForTest('2026-07-19') // 时间来到新的一天
  assert.equal(todayProgress(s, 'm_rk').done, 0, '新的一天今日完成归零')
  assert.equal(todayProgress(s, 'm_rk').rate, 0, '完成率归零')
  assert.equal(todayEarned(s, 'm_rk'), 0, '新的一天今日积分归零')
  assert.equal(completionStatusFor(s, 'm_rk', 't_run'), 'none', '任务重新变为未打卡')
  assert.equal(memberTotal(s, 'm_rk'), 25, '累计总分不受跨天影响')

  // 新的一天打卡 → 记到 07-19
  const s2 = checkInTask(s, 'm_rk', 't_run')
  const cp = s2.completions.find(
    (c) => c.memberId === 'm_rk' && c.taskId === 't_run' && c.status === 'pending',
  )!
  assert.equal(cp.date, '2026-07-19', '新打卡记到新日期')
  assert.equal(daysAgo(0), todayStr()) // 自洽性

  __setTodayForTest('2026-07-18') // 复原，避免影响其它测试
})

console.log(`\n家庭积分乐园 · 逻辑单测全部通过：${passed} 项\n`)
