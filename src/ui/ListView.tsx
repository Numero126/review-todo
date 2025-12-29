import React, { useMemo, useState } from 'react'
import type { AppData, Item } from '../core/types'
import { cmpISO, todayJST } from '../core/date'
import { getSetById } from '../core/storage'
import { moveDueDate, updateItem } from '../core/scheduler'

type SortKey = 'dueAsc' | 'dueDesc' | 'overdueDesc' | 'titleAsc' | 'stageAsc'

function daysDiff(a: string, b: string): number {
  // b - a (days), using UTC
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  const t1 = Date.UTC(y1, m1 - 1, d1)
  const t2 = Date.UTC(y2, m2 - 1, d2)
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24))
}

function overdueDays(item: Item, today: string): number {
  if (cmpISO(item.nextDue, today) >= 0) return 0
  return Math.max(0, daysDiff(item.nextDue, today))
}

export default function ListView({ data, setData }: { data: AppData; setData: (d: AppData) => void }) {
  const today = todayJST()
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [onlyOverdue, setOnlyOverdue] = useState(false)
  const [sort, setSort] = useState<SortKey>('dueAsc')

  const tagStats = useMemo(() => {
    const map = new Map<string, { total: number; overdue: number }>()
    for (const it of data.items) {
      for (const t of it.tags) {
        const cur = map.get(t) ?? { total: 0, overdue: 0 }
        cur.total += 1
        if (cmpISO(it.nextDue, today) < 0) cur.overdue += 1
        map.set(t, cur)
      }
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => (b.overdue - a.overdue) || (b.total - a.total) || a.name.localeCompare(b.name, 'ja'))
  }, [data.items, today])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.items.filter(it => {
      if (tag && !it.tags.includes(tag)) return false
      if (onlyOverdue && cmpISO(it.nextDue, today) >= 0) return false
      if (!q) return true
      return it.title.toLowerCase().includes(q) || it.tags.some(t => t.toLowerCase().includes(q))
    })
  }, [data.items, query, tag, onlyOverdue, today])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      if (sort === 'dueAsc') return cmpISO(a.nextDue, b.nextDue)
      if (sort === 'dueDesc') return cmpISO(b.nextDue, a.nextDue)
      if (sort === 'overdueDesc') return overdueDays(b, today) - overdueDays(a, today) || cmpISO(a.nextDue, b.nextDue)
      if (sort === 'titleAsc') return a.title.localeCompare(b.title, 'ja')
      if (sort === 'stageAsc') return a.stage - b.stage || cmpISO(a.nextDue, b.nextDue)
      return 0
    })
    return arr
  }, [filtered, sort, today])

  const kpi = useMemo(() => {
    const total = data.items.length
    const overdue = data.items.filter(it => cmpISO(it.nextDue, today) < 0).length
    const dueToday = data.items.filter(it => it.nextDue === today).length
    const avgOverdue = (() => {
      const ods = data.items.map(it => overdueDays(it, today)).filter(n => n > 0)
      if (ods.length === 0) return 0
      return Math.round((ods.reduce((a, b) => a + b, 0) / ods.length) * 10) / 10
    })()
    return { total, overdue, dueToday, avgOverdue }
  }, [data.items, today])

  return (
    <div className="grid">
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h1>一覧</h1>
          <span className="badge">全タスクの検索・タグ別・期限順・苦手可視化</span>
        </div>

        <div className="sep" />

        <div className="kpi">
          <div className="card" style={{ minWidth: 160 }}>
            <div className="muted" style={{ fontSize: 12 }}>全タスク</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{kpi.total}</div>
          </div>
          <div className="card" style={{ minWidth: 160, borderColor: kpi.overdue > 0 ? '#b00020' : undefined }}>
            <div className="muted" style={{ fontSize: 12 }}>期限切れ</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: kpi.overdue > 0 ? '#b00020' : undefined }}>{kpi.overdue}</div>
          </div>
          <div className="card" style={{ minWidth: 160 }}>
            <div className="muted" style={{ fontSize: 12 }}>今日が期限</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{kpi.dueToday}</div>
          </div>
          <div className="card" style={{ minWidth: 220 }}>
            <div className="muted" style={{ fontSize: 12 }}>期限切れ平均（日）</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{kpi.avgOverdue}</div>
          </div>
        </div>

        <div className="sep" />

        <div className="grid" style={{ gap: 10 }}>
          <div className="row-wrap" style={{ alignItems: 'flex-end' }}>
            <div style={{ minWidth: 260, flex: 1 }}>
              <label>検索（タイトル/タグ）</label>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="例：標準原価 / 工業簿記 / テキストA" />
            </div>

            <div style={{ minWidth: 220 }}>
              <label>並び替え</label>
              <select value={sort} onChange={e => setSort(e.target.value as SortKey)}>
                <option value="dueAsc">期限が近い順</option>
                <option value="dueDesc">期限が遠い順</option>
                <option value="overdueDesc">苦手（期限切れ日数）順</option>
                <option value="stageAsc">stageが小さい順</option>
                <option value="titleAsc">タイトル順</option>
              </select>
            </div>

            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <label style={{ marginBottom: 0 }}> </label>
              <button className={'btn ' + (onlyOverdue ? 'btn-primary' : '')} onClick={() => setOnlyOverdue(v => !v)}>
                {onlyOverdue ? '期限切れのみON' : '期限切れのみOFF'}
              </button>
            </div>
          </div>

          <div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2>タグ</h2>
              <small className="muted">クリックでフィルター</small>
            </div>
            <div className="row-wrap">
              <span className={'chip ' + (tag === null ? 'active' : '')} onClick={() => setTag(null)}>
                すべて
              </span>
              {tagStats.map(t => (
                <span
                  key={t.name}
                  className={'chip ' + (tag === t.name ? 'active' : '')}
                  onClick={() => setTag(tag === t.name ? null : t.name)}
                  title={`合計 ${t.total} / 期限切れ ${t.overdue}`}
                >
                  {t.name} <span className="badge">{t.overdue}/{t.total}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="sep" />

        <div className="grid">
          {sorted.length === 0 ? (
            <small className="muted">条件に一致するタスクがありません。</small>
          ) : (
            sorted.map(it => (
              <ItemRow
                key={it.id}
                item={it}
                data={data}
                today={today}
                onDue={(d) => setData(moveDueDate(data, it.id, d))}
                onSet={(setId) => setData(updateItem(data, it.id, { intervalSetId: setId }))}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function ItemRow(props: {
  item: Item
  data: AppData
  today: string
  onDue: (d: string) => void
  onSet: (setId: string) => void
}) {
  const { item, data, today, onDue, onSet } = props
  const set = getSetById(data.intervalSets, item.intervalSetId)
  const od = overdueDays(item, today)
  const isOverdue = od > 0

  return (
    <div className="card" style={{ borderColor: isOverdue ? '#b00020' : undefined }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, wordBreak: 'break-word' }}>{item.title}</div>

          <div className="row-wrap" style={{ marginTop: 8 }}>
            <span className={'badge ' + (isOverdue ? 'badge-overdue' : '')}>
              {isOverdue ? `期限切れ ${od}日` : '期限内'}
            </span>
            <span className="badge">期限：<span className="mono">{item.nextDue}</span></span>
            <span className="badge">stage：{item.stage}</span>
            <span className="badge">間隔：{set.name}</span>
          </div>

          {item.tags.length > 0 && (
            <div className="row-wrap" style={{ marginTop: 8 }}>
              {item.tags.map(t => <span key={t} className="badge">{t}</span>)}
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <small className="muted">最後に完了：{item.lastDone ?? '未完了'}</small>
          </div>
        </div>

        <div style={{ minWidth: 260 }}>
          <div style={{ marginBottom: 10 }}>
            <label>期限（日付）</label>
            <input type="date" value={item.nextDue} onChange={e => onDue(e.target.value)} />
          </div>
          <div>
            <label>間隔セット</label>
            <select value={set.id} onChange={e => onSet(e.target.value)}>
              {data.intervalSets.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.isDefault ? '（デフォルト）' : ''} — [{s.intervalsDays.join(', ')}]
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
