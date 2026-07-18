import { useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts'
import { useStore } from '../store/StoreContext'
import { memberById, switchMember } from '../store/logic'
import {
  statSummary,
  weeklyBars,
  categoryDistribution,
  pointsTrend,
  type Period,
} from '../store/stats'
import { CHART_COLORS } from '../data/constants'
import { Card, StatCard, PillTabs } from '../components/ui'
import { IconTrophy, IconCheck, IconClock, IconX } from '../components/icons'

export function Stats() {
  const { state, mutate } = useStore()
  const member = memberById(state, state.currentMemberId)!
  const [period, setPeriod] = useState<Period>('week')

  const summary = statSummary(state, member.id, period)
  const bars = weeklyBars(state, member.id)
  const dist = categoryDistribution(state, member.id, period)
  const trend = pointsTrend(state, member.id)
  const maxBar = Math.max(4, ...bars.map((b) => b.count))

  return (
    <div className="space-y-5">
      {/* 页头 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-800">
          📊 统计概览
        </h1>
        <div className="flex items-center gap-3">
          <select
            value={member.id}
            onChange={(e) => mutate((s) => switchMember(s, e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-indigo-400"
          >
            {state.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <PillTabs
            active={period}
            onChange={setPeriod}
            tabs={[
              { key: 'week', label: '本周' },
              { key: 'month', label: '本月' },
            ]}
          />
        </div>
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard tone="indigo" icon={<IconTrophy width={22} height={22} />} label="总积分" value={summary.total} />
        <StatCard tone="sky" icon={<IconCheck width={22} height={22} />} label="完成次数" value={summary.completions} />
        <StatCard tone="amber" icon={<IconClock width={22} height={22} />} label="待确认" value={summary.pending} />
        <StatCard tone="rose" icon={<IconX width={22} height={22} />} label="已驳回" value={summary.rejected} />
      </div>

      {/* 柱状 + 环形 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold text-slate-800">每周完成情况</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bars} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} />
                <YAxis
                  allowDecimals={false}
                  domain={[0, maxBar]}
                  tick={{ fontSize: 12, fill: CHART_COLORS.axis }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip cursor={{ fill: 'rgba(59,130,246,0.06)' }} formatter={(v) => [`${v} 次`, '完成']} />
                <Bar dataKey="count" fill={CHART_COLORS.bar} radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold text-slate-800">任务类别分布</h2>
          <div className="h-64">
            {dist.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                本周期暂无完成数据
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dist}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={92}
                    paddingAngle={3}
                    cornerRadius={6}
                  >
                    {dist.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v} 次`, n]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {dist.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-4">
              {dist.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-sm text-slate-500">
                  <span className="inline-block h-3 w-3 rounded-sm" style={{ background: d.color }} />
                  {d.name}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 积分趋势 */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-bold text-slate-800">积分趋势</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.line} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={CHART_COLORS.line} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`${v} 分`, '每日积分']} />
              <Area
                type="monotone"
                dataKey="points"
                stroke={CHART_COLORS.line}
                strokeWidth={2.5}
                fill="url(#trendFill)"
                dot={{ r: 3, fill: CHART_COLORS.line }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 flex items-center justify-center gap-1.5 text-sm text-slate-500">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS.line }} />
          每日积分
        </div>
      </Card>
    </div>
  )
}
