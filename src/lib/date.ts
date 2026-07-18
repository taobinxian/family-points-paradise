// 时区安全的日期工具：全程用 UTC 构造 + UTC 读取，避免「本地构造 + toISOString(UTC)」导致的 off-by-one。
// 所有输入/输出均为 'YYYY-MM-DD' 字符串。

function parse(dateStr: string): [number, number, number] {
  const [y, m, d] = dateStr.split('-').map(Number)
  return [y, m, d]
}

/** dateStr 往后（正）/往前（负）n 天 */
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = parse(dateStr)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** 星期索引 0=Sun … 6=Sat */
export function weekdayIndex(dateStr: string): number {
  const [y, m, d] = parse(dateStr)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** a - b 相差天数（正表示 a 晚于 b） */
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = parse(a)
  const [by, bm, bd] = parse(b)
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000)
}

/** M/D 短标签，如 7/18 */
export function shortLabel(dateStr: string): string {
  const [, m, d] = parse(dateStr)
  return `${m}/${d}`
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export function weekdayLabel(dateStr: string): string {
  return WEEKDAY_LABELS[weekdayIndex(dateStr)]
}

/** 是否与 anchor 同一自然月 */
export function sameMonth(dateStr: string, anchor: string): boolean {
  return dateStr.slice(0, 7) === anchor.slice(0, 7)
}
