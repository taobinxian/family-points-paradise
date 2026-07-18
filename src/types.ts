// 家庭积分乐园 —— 领域模型
// 所有积分口径以「积分流水（ledger）」为单一事实来源：成员当前总分 = 该成员所有流水条目之和。

export type CategoryId = string
export type MemberId = string
export type TaskId = string

/** 家庭成员（孩子） */
export interface Member {
  id: MemberId
  name: string
  avatar: string // emoji 头像
}

/** 任务分类（运动 / 学习 / 家务 …） */
export interface Category {
  id: CategoryId
  name: string
  emoji: string
}

/** 打卡任务规则 */
export interface TaskRule {
  id: TaskId
  name: string
  points: number
  categoryId: CategoryId
  emoji: string
  /** 共同任务：全体成员都要完成。为 true 时 memberId 忽略（置 null） */
  shared: boolean
  /** 指定孩子：shared=false 时该任务只归属此成员；shared=true 时为 null */
  memberId: MemberId | null
}

export type CompletionStatus = 'pending' | 'confirmed'

/** 某成员某天对某任务的打卡记录 */
export interface Completion {
  id: string
  taskId: TaskId
  memberId: MemberId
  date: string // YYYY-MM-DD
  status: CompletionStatus
  pointsEarned: number
  submittedAt: string // ISO
}

export type LedgerTag = '任务所得' | '调整' | '兑换' | '额外奖励'

/** 积分流水条目 */
export interface LedgerEntry {
  id: string
  memberId: MemberId
  points: number // 正数奖励，负数扣除
  tag: LedgerTag
  description: string
  createdAt: string // ISO
}

export type PrizeKind = 'physical' | 'virtual'

/** 心愿奖品（实物）/ 虚拟奖励 */
export interface Prize {
  id: string
  kind: PrizeKind
  name: string
  emoji: string
  /** 兑换所需积分（虚拟为「每次」消耗） */
  cost: number
  /** 心愿归属成员；虚拟奖励为 null 表示全员可兑 */
  memberId: MemberId | null
  /** 虚拟奖励的兑换价值描述，如「30 分钟」 */
  rewardValue?: string
}

export type RedemptionStatus = 'pending' | 'approved' | 'rejected'

/** 兑换申请 */
export interface Redemption {
  id: string
  prizeId: string
  prizeName: string
  memberId: MemberId
  cost: number
  status: RedemptionStatus
  createdAt: string // ISO
}

export interface AppConfig {
  parentPin: string
}

/** 全量应用状态（持久化到 localStorage） */
export interface AppState {
  members: Member[]
  categories: Category[]
  tasks: TaskRule[]
  completions: Completion[]
  ledger: LedgerEntry[]
  prizes: Prize[]
  redemptions: Redemption[]
  config: AppConfig
  /** 当前查看的成员 */
  currentMemberId: MemberId
}
