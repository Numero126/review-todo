import React, { useMemo, useState } from 'react'
import type { AppData, Item, Priority } from '../core/types'
import { todayJST, tomorrowJST, cmpISO } from '../core/date'
import { getSetById, createItem } from '../core/storage'
import { completeItem, getTodayTodos, getCompletedOnDate, moveDueDate, resetItem, undoComplete } from '../core/scheduler'

function tagBadges(tags: string[]) {
  return (
    <div className="row-wrap">
      {tags.filter(Boolean).map(t => (
        <span key={t} className="badge">{t}</span>
      ))}
    </div>
  )
}

function priorityBadge(p: Priority) {
  const cls = p === 1 ? 'badge badge-pri1' : p === 3 ? 'badge badge-pri3' : 'badge badge-pri2'
  const txt = p === 1 ? '優先: 高' : p === 3 ? '優先: 低' : '優先: 中'
  return <span className={cls}>{txt}</span>
}

function minutesBadge(m: number | null) {
  if (m == null) return null
  return <span className="badge">{m}分</span>
}

function dueLabel(due: string, today: string) {
  const [y1, m1, d1] = due.split('-').map(Number)
  const [y2, m2, d2] = today.split('-').map(Number)
  const a = Date.UTC(y1, m1 - 1, d1)
  const b = Date.UTC(y2, m2 - 1, d2)
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24))
  if (diff === 0) return '今日'
  if (diff === 1) return '昨日（期限）'
  if (diff > 1) return `${diff}日前（期限）`
  return '未来'
}

function parseQuick(line: string): { title: string; tags: string[]; priority?: Priority; targetMinutes?: number | null } | null {
  const raw = line.trim()
  if (!raw) return null
  const parts = raw.split(/\s+/)
  const tags: string[] = []
  let priority: Priority | undefined
  let targetMinutes: number | null | undefined
  const titleParts: string[] = []
  for (const p of parts) {
    if (p.startsWith('#') && p.length > 1) { tags.push(p.slice(1)); continue }
    if (/^!([1-3])$/.test(p)) { priority = Number(p.slice(1)) as Priority; continue }
    if (/^(~?\d+)(m|min)$/i.test(p)) { const n = Number(p.replace(/[^0-9]/g,'')); if (!Number.isNaN(n)) targetMinutes = n; continue }
    if (/^~\d+$/.test(p)) { const n = Number(p.slice(1)); if (!Number.isNaN(n)) targetMinutes = n; continue }
    titleParts.push(p)
  }
  const title = titleParts.join(' ').trim()
  if (!title) return null
  return { title, tags, priority, targetMinutes }
}

function updateItem(data: AppData, id: string, patch: Partial<Item>): AppData {
  return { ...data, items: data.items.map(it => (it.id === id ? ({ ...it, ...patch }) : it)) }
}

function TodoRow({
  item,
  data,
  today,
  tomorrow,
  onComplete,
  onReset,
  onMoveTomorrow,
  onMoveDate,
  onUndo,
  showToast,
  setData,
}: {
  item: Item
  data: AppData
  today: string
  tomorrow: string
  onComplete: () => void
  onReset: () => void
  onMoveTomorrow: () => void
  onMoveDate: (d: string) => void
  onUndo?: () => void
  showToast: (m: string) => void
  setData: (d: AppData) => void
}) {
  const setInfo = getSetById(data.intervalSets, item.intervalSetId)
  const [date, setDate] = useState(item.nextDue)
  const [open, setOpen] = useState(false)
  const [pri, setPri] = useState<Priority>(item.priority ?? 2)
  const [mins, setMins] = useState<string>(item.targetMinutes == null ? '' : String(item.targetMinutes))
  const [notes, setNotes] = useState(item.notes ?? '')

  function saveDetails() {
    const m = mins.trim() ? Number(mins.trim()) : null
    setData(updateItem(data, item.id, { priority: pri, targetMinutes: Number.isFinite(m as any) ? m : null, notes }))
    showToast('保存しました')
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, wordBreak: 'break-word' }}>{item.title}</div>
          <div className="row-wrap" style={{ marginTop: 8 }}>
            <span className={'badge ' + (cmpISO(item.nextDue, today) < 0 ? 'badge-overdue' : '')}>
              期限：{item.nextDue}（{dueLabel(item.nextDue, today)}）
            </span>
            {priorityBadge(item.priority ?? 2)}
            {minutesBadge(item.targetMinutes ?? null)}
            <span className="badge">間隔：{setInfo.name} / stage {item.stage}</span>
          </div>
          <div style={{ marginTop: 8 }}>{tagBadges(item.tags)}</div>
          {item.notes ? (
            <div style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>
              <small className="muted">備考：</small>
              <div>{item.notes}</div>
            </div>
          ) : null}
        </div>

        <div className="col" style={{ alignItems: 'flex-end', gap: 8 }}>
          <button className="btn btn-primary" onClick={onComplete}>
            完了
          </button>
          <button className="btn" onClick={onMoveTomorrow}>
            明日へ
          </button>
          <div className="row" style={{ gap: 8 }}>
            <input type="date" value={date} onChange={e => { setDate(e.target.value); }} style={{ maxWidth: 160 }} />
            <button className="btn" onClick={() => onMoveDate(date)}>
              日付
            </button>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={onReset} title="stage=0 / 期限=今日に戻します">
              リセット
            </button>
            {onUndo ? (
              <button className="btn" onClick={onUndo}>
                取り消し
              </button>
            ) : null}
          </div>
          <button className="btn" onClick={() => setOpen(!open)}>{open ? '詳細を閉じる' : '詳細（編集）'}</button>
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
            <button className="btn btn-primary" onClick={saveDetails}>
              保存
            </button>
            <small className="muted">優先度 / 目標時間 / 備考 を更新します</small>
          </div>
        </>
      ) : null}
    </div>
  )
}

export default function TodayView({ data, setData }: { data: AppData; setData: (d: AppData) => void }) {
  const today = todayJST()
  const tomorrow = tomorrowJST()

  const todosToday = useMemo(() => getTodayTodos(data, today), [data, today])
  const completedToday = useMemo(() => getCompletedOnDate(data, today), [data, today])
  const todosTomorrowExact = useMemo(() => data.items.filter(it => it.nextDue === tomorrow).sort((a, b) => a.title.localeCompare(b.title, 'ja')), [data.items, tomorrow])

  const overdueCount = useMemo(() => todosToday.filter(it => cmpISO(it.nextDue, today) < 0).length, [todosToday, today])

  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [quick, setQuick] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }

  function onQuickAdd() {
    const parsed = parseQuick(quick)
    if (!parsed) return
    const defaultSet = data.intervalSets.find(s => s.isDefault) ?? data.intervalSets[0]
    const item = createItem(
      {
        title: parsed.title,
        tags: parsed.tags,
        intervalSetId: defaultSet.id,
        startDue: today,
        priority: parsed.priority ?? 2,
        targetMinutes: parsed.targetMinutes ?? null,
        notes: '',
      },
      data.intervalSets,
    )
    setData({ ...data, items: [item, ...data.items] })
    setQuick('')
    showToast('追加しました')
  }

  const filteredToday = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return todosToday
    return todosToday.filter(it => (it.title + ' ' + it.tags.join(' ') + ' ' + (it.notes ?? '')).toLowerCase().includes(q))
  }, [query, todosToday])

  return (
    <div className="grid grid-2">
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h1>今日</h1>
          <div className="row" style={{ gap: 8 }}>
            <span className="badge">今日のToDo: {todosToday.length}</span>
            <span className="badge badge-overdue">期限切れ: {overdueCount}</span>
          </div>
        </div>

        <div className="sep" />

        <label>クイック追加（Enter）</label>
        <input
          placeholder="例：工業簿記 標準原価 #工業簿記 !1 ~40"
          value={quick}
          onChange={e => setQuick(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') onQuickAdd()
          }}
        />
        <small className="muted">#タグ / !1〜!3（優先度） / ~30（分）に対応。間隔セットはデフォルトで「今日」に追加します。</small>

        <div className="sep" />

        <label>検索</label>
        <input placeholder="タイトル / タグ / 備考 で検索" value={query} onChange={e => setQuery(e.target.value)} />

        <div style={{ marginTop: 12 }}>
          {filteredToday.length === 0 ? (
            <div>
              <p style={{ marginTop: 0 }}>今日やる復習はありません。</p>
              <small>「追加」または上のクイック追加で登録できます。</small>
            </div>
          ) : (
            <div className="grid">
              {filteredToday.map(it => (
                <TodoRow
                  key={it.id}
                  item={it}
                  data={data}
                  today={today}
                  tomorrow={tomorrow}
                  setData={setData}
                  showToast={showToast}
                  onComplete={() => {
                    setData(completeItem(data, it.id, today))
                    showToast('完了しました（下の「完了済み」に残ります）')
                  }}
                  onReset={() => {
                    setData(resetItem(data, it.id, today))
                    showToast('やり直しにしました（stage=0 / 期限=今日）')
                  }}
                  onMoveTomorrow={() => {
                    setData(moveDueDate(data, it.id, tomorrow))
                    showToast('明日に回しました')
                  }}
                  onMoveDate={d => {
                    setData(moveDueDate(data, it.id, d))
                    showToast(`期限を ${d} に変更しました`)
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {toast ? (
          <div className="toast" role="status">
            {toast}
          </div>
        ) : null}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>完了済み（今日）: {completedToday.length}</h2>

        <details open>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>一覧</summary>
          <div style={{ marginTop: 10 }} className="grid">
            {completedToday.length === 0 ? (
              <small className="muted">まだありません。</small>
            ) : (
              completedToday.map(it => (
                <TodoRow
                  key={it.id}
                  item={it}
                  data={data}
                  today={today}
                  tomorrow={tomorrow}
                  setData={setData}
                  showToast={showToast}
                  onComplete={() => {
                    // already completed today, no-op
                    showToast('既に完了しています')
                  }}
                  onReset={() => {
                    setData(resetItem(data, it.id, today))
                    showToast('やり直しにしました（stage=0 / 期限=今日）')
                  }}
                  onMoveTomorrow={() => {
                    setData(moveDueDate(data, it.id, tomorrow))
                    showToast('明日に回しました')
                  }}
                  onMoveDate={d => {
                    setData(moveDueDate(data, it.id, d))
                    showToast(`期限を ${d} に変更しました`)
                  }}
                  onUndo={() => {
                    setData(undoComplete(data, it.id))
                    showToast('取り消しました（今日のToDoに戻る場合があります）')
                  }}
                />
              ))
            )}
          </div>
        </details>

        <div className="sep" />

        <details open>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>明日のToDo（予定）: {todosTomorrowExact.length}</summary>
          <div style={{ marginTop: 10 }} className="grid">
            {todosTomorrowExact.length === 0 ? (
              <small className="muted">まだありません。</small>
            ) : (
              todosTomorrowExact.map(it => (
                <div key={it.id} className="card">
                  <div style={{ fontWeight: 800, wordBreak: 'break-word' }}>{it.title}</div>
                  <div className="row-wrap" style={{ marginTop: 8 }}>
                    {priorityBadge(it.priority ?? 2)}
                    {minutesBadge(it.targetMinutes ?? null)}
                    <button className="btn" onClick={() => setData(moveDueDate(data, it.id, today))} title="今日に戻します">
                      今日へ
                    </button>
                    <button className="btn" onClick={() => (location.hash = '#timer')} title="タイマーで取り組む">
                      タイマーへ
                    </button>
                  </div>
                  <div style={{ marginTop: 8 }}>{tagBadges(it.tags)}</div>
                </div>
              ))
            )}
          </div>
        </details>
      </div>
    </div>
  )
}
