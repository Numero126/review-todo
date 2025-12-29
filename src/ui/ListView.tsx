import React, { useMemo, useState } from 'react'
import type { AppData, Item, Priority } from '../core/types'
import { cmpISO, todayJST } from '../core/date'
import { getSetById } from '../core/storage'
import { moveDueDate, updateItem } from '../core/scheduler'

type SortKey = 'dueAsc' | 'dueDesc' | 'overdueDesc' | 'titleAsc' | 'stageAsc' | 'priorityAsc'

function daysDiff(a: string, b: string): number {
  // b - a (days), using UTC
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  const t1 = Date.UTC(y1, m1 - 1, d1)
  const t2 = Date.UTC(y2, m2 - 1, d2)
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24))
}

function overdueDays(item: Item, today: string): number {
  return Math.max(0, daysDiff(item.nextDue, today))
}

function priorityBadge(p: Priority) {
  const cls = p === 1 ? 'badge badge-pri1' : p === 3 ? 'badge badge-pri3' : 'badge badge-pri2'
  const txt = p === 1 ? '優先: 高' : p === 3 ? '優先: 低' : '優先: 中'
  return <span className={cls}>{txt}</span>
}

export default function ListView({ data, setData }: { data: AppData; setData: (d: AppData) => void }) {
  const today = todayJST()

  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string>('')
  const [onlyOverdue, setOnlyOverdue] = useState(false)
  const [sort, setSort] = useState<SortKey>('overdueDesc')

  const tags = useMemo(() => {
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
      return (
        it.title.toLowerCase().includes(q) ||
        (it.notes ?? '').toLowerCase().includes(q) ||
        it.tags.some(t => t.toLowerCase().includes(q))
      )
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
      if (sort === 'priorityAsc') return (a.priority ?? 2) - (b.priority ?? 2) || overdueDays(b, today) - overdueDays(a, today)
      return 0
    })
    return arr
  }, [filtered, sort, today])

  const kpi = useMemo(() => {
    const total = data.items.length
    const overdue = data.items.filter(it => cmpISO(it.nextDue, today) < 0).length
    const dueToday = data.items.filter(it => it.nextDue === today).length
    const avgOverdue =
      overdue === 0
        ? 0
        : Math.round(
            (data.items
              .filter(it => cmpISO(it.nextDue, today) < 0)
              .reduce((sum, it) => sum + overdueDays(it, today), 0) /
              overdue) * 10,
          ) / 10
    return { total, overdue, dueToday, avgOverdue }
  }, [data.items, today])

  return (
    <div className="grid">
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h1>一覧</h1>
          <span className="badge">全タスク検索 / タグ別 / 期限順 / 苦手の可視化</span>
        </div>

        <div className="sep" />

        <div className="row-wrap">
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
              <label>検索（タイトル/タグ/備考）</label>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="例：標準原価 / 工業簿記 / テキストA" />
            </div>

            <div style={{ minWidth: 220 }}>
              <label>並び替え</label>
              <select value={sort} onChange={e => setSort(e.target.value as SortKey)}>
                <option value="overdueDesc">苦手（期限切れ大）→</option>
                <option value="dueAsc">期限（早い）→</option>
                <option value="dueDesc">期限（遅い）→</option>
                <option value="titleAsc">タイトル（A→）</option>
                <option value="stageAsc">Stage（小→）</option>
                <option value="priorityAsc">優先度（高→）</option>
              </select>
            </div>

            <div style={{ minWidth: 220 }}>
              <label>フィルタ</label>
              <label className="row" style={{ gap: 8 }}>
                <input type="checkbox" checked={onlyOverdue} onChange={e => setOnlyOverdue(e.target.checked)} />
                期限切れのみ
              </label>
            </div>
          </div>

          <div>
            <label>タグ</label>
            <div className="row-wrap">
              <button className={'btn ' + (!tag ? 'btn-primary' : '')} onClick={() => setTag('')}>
                すべて
              </button>
              {tags.slice(0, 40).map(t => (
                <button key={t.name} className={'btn ' + (tag === t.name ? 'btn-primary' : '')} onClick={() => setTag(t.name)}>
                  {t.name} <span className="badge">{t.overdue}/{t.total}</span>
                </button>
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
                onPatch={(patch) => setData(updateItem(data, it.id, patch))}
                onDue={(d) => setData(moveDueDate(data, it.id, d))}
                onSet={(setId) => setData(updateItem(data, it.id, { intervalSetId: setId }))}
              />
            ))
          )}
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>苦手の可視化</h2>
        <p style={{ marginTop: 0 }}>
          「期限切れ日数」が大きいほど、優先して潰すべきタスクです（並び替え：苦手）。<br />
          さらに、優先度（高/中/低）と目標時間（分）を入れておくと、今日の取り組み計画が立てやすくなります。
        </p>

        <div className="sep" />

        <h3 style={{ marginTop: 0 }}>タグ別（期限切れ / 全体）</h3>
        <div className="row-wrap">
          {tags.slice(0, 30).map(t => (
            <span key={t.name} className="badge">
              {t.name}: {t.overdue}/{t.total}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function ItemRow({
  item,
  data,
  today,
  onDue,
  onSet,
  onPatch,
}: {
  item: Item
  data: AppData
  today: string
  onDue: (d: string) => void
  onSet: (setId: string) => void
  onPatch: (patch: Partial<Item>) => void
}) {
  const set = getSetById(data.intervalSets, item.intervalSetId)
  const isOverdue = cmpISO(item.nextDue, today) < 0
  const od = overdueDays(item, today)

  const [open, setOpen] = useState(false)
  const [pri, setPri] = useState<Priority>(item.priority ?? 2)
  const [mins, setMins] = useState<string>(item.targetMinutes == null ? '' : String(item.targetMinutes))
  const [notes, setNotes] = useState(item.notes ?? '')

  function save() {
    const m = mins.trim() ? Number(mins.trim()) : null
    onPatch({ priority: pri, targetMinutes: Number.isFinite(m as any) ? m : null, notes })
    setOpen(false)
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, wordBreak: 'break-word' }}>{item.title}</div>

          <div className="row-wrap" style={{ marginTop: 8 }}>
            <span className={'badge ' + (isOverdue ? 'badge-overdue' : '')}>
              期限：{item.nextDue}{isOverdue ? `（${od}日遅れ）` : ''}
            </span>
            {priorityBadge(item.priority ?? 2)}
            {item.targetMinutes != null ? <span className="badge">{item.targetMinutes}分</span> : null}
            <span className="badge">間隔：{set.name} / stage {item.stage}</span>
          </div>

          <div style={{ marginTop: 8 }} className="row-wrap">
            {item.tags.map(t => (
              <span key={t} className="badge">{t}</span>
            ))}
          </div>

          {item.notes ? (
            <div style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>
              <small className="muted">備考：</small>
              <div>{item.notes}</div>
            </div>
          ) : null}

          <div style={{ marginTop: 8 }}>
            <small className="muted">最後に完了：{item.lastDone ?? '未完了'}</small>
          </div>
        </div>

        <div style={{ minWidth: 280 }}>
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

          <div style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => setOpen(!open)}>{open ? '編集を閉じる' : '優先度/時間/備考を編集'}</button>
          </div>
        </div>
      </div>

      {open ? (
        <>
          <div className="sep" />
          <div className="grid grid-2">
            <div>
              <label>優先度</label>
              <select value={pri} onChange={e => setPri(Number(e.target.value) as any)}>
                <option value="1">高（1）</option>
                <option value="2">中（2）</option>
                <option value="3">低（3）</option>
              </select>
            </div>
            <div>
              <label>目標時間（分）</label>
              <input inputMode="numeric" placeholder="例：30" value={mins} onChange={e => setMins(e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label>備考（メモ）</label>
            <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="row" style={{ marginTop: 12, gap: 10 }}>
            <button className="btn btn-primary" onClick={save}>保存</button>
            <button className="btn" onClick={() => setOpen(false)}>キャンセル</button>
          </div>
        </>
      ) : null}
    </div>
  )
}
