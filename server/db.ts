// SQLite 落库层（使用 Node 内置 node:sqlite，无需原生模块，可直接部署到服务器）
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSeedState } from '../src/data/seed.ts'
import type { AppState } from '../src/types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data')
const DB_PATH = process.env.DB_PATH || join(DATA_DIR, 'app.db')

mkdirSync(DATA_DIR, { recursive: true })

const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')

// ---------- Schema ----------
db.exec(`
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar TEXT NOT NULL, sort INTEGER
);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, emoji TEXT NOT NULL, sort INTEGER
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, points INTEGER NOT NULL,
  categoryId TEXT NOT NULL, emoji TEXT NOT NULL, shared INTEGER NOT NULL, memberId TEXT, sort INTEGER
);
CREATE TABLE IF NOT EXISTS completions (
  id TEXT PRIMARY KEY, taskId TEXT NOT NULL, memberId TEXT NOT NULL, date TEXT NOT NULL,
  status TEXT NOT NULL, pointsEarned INTEGER NOT NULL, submittedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger (
  id TEXT PRIMARY KEY, memberId TEXT NOT NULL, points INTEGER NOT NULL,
  tag TEXT NOT NULL, description TEXT NOT NULL, createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS prizes (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, emoji TEXT NOT NULL,
  cost INTEGER NOT NULL, memberId TEXT, rewardValue TEXT, sort INTEGER
);
CREATE TABLE IF NOT EXISTS redemptions (
  id TEXT PRIMARY KEY, prizeId TEXT NOT NULL, prizeName TEXT NOT NULL, memberId TEXT NOT NULL,
  cost INTEGER NOT NULL, status TEXT NOT NULL, createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY, value TEXT NOT NULL
);
-- 乐观并发版本号，独立于业务表，不被整库覆盖清空
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY, value TEXT NOT NULL
);
`)

// 轻量迁移：为已存在的旧库补齐后加的列（幂等，列已存在则忽略）
function ensureColumn(table: string, column: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
  }
}
ensureColumn('tasks', 'memberId', 'memberId TEXT')

/** 当前数据版本号（乐观并发用） */
export function getRev(): number {
  const row = db.prepare("SELECT value FROM meta WHERE key='rev'").get() as
    | { value: string }
    | undefined
  return row ? Number(row.value) : 0
}

/** 版本号自增并返回新值 */
export function bumpRev(): number {
  const next = getRev() + 1
  db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=?').run(
    'rev',
    String(next),
    String(next),
  )
  return next
}

// ---------- 读取整库 → AppState ----------
export function loadState(): AppState {
  const members = db.prepare('SELECT id,name,avatar FROM members ORDER BY sort').all() as AppState['members']
  const categories = db.prepare('SELECT id,name,emoji FROM categories ORDER BY sort').all() as AppState['categories']
  const tasksRaw = db
    .prepare('SELECT id,name,points,categoryId,emoji,shared,memberId FROM tasks ORDER BY sort')
    .all() as Array<Record<string, unknown>>
  const tasks = tasksRaw.map((t) => ({
    ...t,
    shared: !!t.shared,
    memberId: (t.memberId as string | null) ?? null,
  })) as AppState['tasks']
  const completions = db
    .prepare('SELECT id,taskId,memberId,date,status,pointsEarned,submittedAt FROM completions')
    .all() as AppState['completions']
  const ledger = db
    .prepare('SELECT id,memberId,points,tag,description,createdAt FROM ledger ORDER BY createdAt DESC')
    .all() as AppState['ledger']
  const prizes = db
    .prepare('SELECT id,kind,name,emoji,cost,memberId,rewardValue FROM prizes ORDER BY sort')
    .all() as AppState['prizes']
  const redemptions = db
    .prepare('SELECT id,prizeId,prizeName,memberId,cost,status,createdAt FROM redemptions ORDER BY createdAt DESC')
    .all() as AppState['redemptions']
  const cfg = Object.fromEntries(
    (db.prepare('SELECT key,value FROM config').all() as Array<{ key: string; value: string }>).map((r) => [
      r.key,
      r.value,
    ]),
  )
  return {
    members,
    categories,
    tasks,
    completions,
    ledger,
    prizes,
    redemptions,
    config: { parentPin: cfg.parentPin ?? '0000' },
    currentMemberId: cfg.currentMemberId ?? members[0]?.id ?? '',
  }
}

// ---------- 整库覆盖写入（事务内 delete + insert） ----------
export function saveState(state: AppState): void {
  db.exec('BEGIN')
  try {
    db.exec(
      'DELETE FROM members; DELETE FROM categories; DELETE FROM tasks; DELETE FROM completions; DELETE FROM ledger; DELETE FROM prizes; DELETE FROM redemptions; DELETE FROM config;',
    )
    const insMember = db.prepare('INSERT INTO members(id,name,avatar,sort) VALUES(?,?,?,?)')
    state.members.forEach((m, i) => insMember.run(m.id, m.name, m.avatar, i))

    const insCat = db.prepare('INSERT INTO categories(id,name,emoji,sort) VALUES(?,?,?,?)')
    state.categories.forEach((c, i) => insCat.run(c.id, c.name, c.emoji, i))

    const insTask = db.prepare(
      'INSERT INTO tasks(id,name,points,categoryId,emoji,shared,memberId,sort) VALUES(?,?,?,?,?,?,?,?)',
    )
    state.tasks.forEach((t, i) =>
      insTask.run(t.id, t.name, t.points, t.categoryId, t.emoji, t.shared ? 1 : 0, t.memberId ?? null, i),
    )

    const insCp = db.prepare(
      'INSERT INTO completions(id,taskId,memberId,date,status,pointsEarned,submittedAt) VALUES(?,?,?,?,?,?,?)',
    )
    state.completions.forEach((c) =>
      insCp.run(c.id, c.taskId, c.memberId, c.date, c.status, c.pointsEarned, c.submittedAt),
    )

    const insLed = db.prepare(
      'INSERT INTO ledger(id,memberId,points,tag,description,createdAt) VALUES(?,?,?,?,?,?)',
    )
    state.ledger.forEach((l) => insLed.run(l.id, l.memberId, l.points, l.tag, l.description, l.createdAt))

    const insPrize = db.prepare(
      'INSERT INTO prizes(id,kind,name,emoji,cost,memberId,rewardValue,sort) VALUES(?,?,?,?,?,?,?,?)',
    )
    state.prizes.forEach((p, i) =>
      insPrize.run(p.id, p.kind, p.name, p.emoji, p.cost, p.memberId ?? null, p.rewardValue ?? null, i),
    )

    const insRd = db.prepare(
      'INSERT INTO redemptions(id,prizeId,prizeName,memberId,cost,status,createdAt) VALUES(?,?,?,?,?,?,?)',
    )
    state.redemptions.forEach((r) =>
      insRd.run(r.id, r.prizeId, r.prizeName, r.memberId, r.cost, r.status, r.createdAt),
    )

    const insCfg = db.prepare('INSERT INTO config(key,value) VALUES(?,?)')
    insCfg.run('parentPin', state.config.parentPin)
    insCfg.run('currentMemberId', state.currentMemberId)

    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

// ---------- 空库时用种子初始化 ----------
export function ensureSeeded(): void {
  const row = db.prepare('SELECT COUNT(*) AS n FROM members').get() as { n: number }
  if (row.n === 0) {
    saveState(createSeedState())
    console.log('[db] 空库，已用种子数据初始化')
  }
}

export function resetToSeed(): AppState {
  const seed = createSeedState()
  saveState(seed)
  bumpRev()
  return loadState()
}

export { DB_PATH }
