import { MIN, type Message } from './data'
const dayKey = (at: number) => new Date(at).toDateString()
export function dayDiff(at: number) {
  const a = new Date(at); a.setHours(0, 0, 0, 0)
  const b = new Date(); b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}
export function dayLabel(at: number) {
  const diff = dayDiff(at)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  const d = new Date(at)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export type Row =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'msg'; key: number; m: Message; start: boolean; end: boolean }
export function buildRows(list: Message[]): Row[] {
  const out: Row[] = []
  let prevDay = ''
  list.forEach((m, i) => {
    const day = dayKey(m.at)
    if (day !== prevDay) {
      out.push({ kind: 'day', key: 'day-' + day, label: dayLabel(m.at) })
      prevDay = day
    }
    const prev = list[i - 1]
    const next = list[i + 1]
    const start = !prev || prev.mine !== m.mine || dayKey(prev.at) !== day || m.at - prev.at > 5 * MIN
    const end = !next || next.mine !== m.mine || dayKey(next.at) !== day || next.at - m.at > 5 * MIN
    out.push({ kind: 'msg', key: m.id, m, start, end })
  })
  return out
}
