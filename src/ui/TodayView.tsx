import React, { useMemo, useState } from 'react'
import type { AppData, Item } from '../core/types'
import { todayJST, tomorrowJST, cmpISO } from '../core/date'
import { getSetById } from '../core/storage'
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

function daysAgoLabel(due: string, today: string): string {
  if (cmpISO(due, today) === 0) return '今日'
  if (cmpISO(due, today) > 0) return '未来'
  const [y1, m1, d1] = due.split('-').map(Number)
  const [y2, m2, d2] = today.split('-').map(Number)
  const a = Date.UTC(y1, m1 - 1, d1)
  const b = Date.UTC(y2, m2 - 1, d2)
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24))
  return `${diff}日前（期限）`
}

export default function TodayView({ data, setData }: { data: AppData; setData: (d: AppData) => void }) {
  const today = todayJST()
  const tomorrow = tomorrowJST()

  const todosToday = useMemo(() => getTodayTodos(data, today), [data, today])
  const completedToday = useMemo(() => getCompletedOnDate(data, today), [data, today])
  const todosTomorrowExact = useMemo(
    () => data.items.filter(it => it.nextDue === tomorrow).sort((a, b) => a.title.localeCompare(b.title, 'ja')),
    [data.items, tomorrow],
  )

  const overdueCount = useMemo(() => todosToday.filter(it => cmpISO(it.nextDue, today) < 0).length, [todosToday, today])

  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }

  const filteredToday = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return todosToday
    return todosToday.filter(
      it => it.title.toLowerCase().includes(q) || it.tags.some(t => t.toLowerCase().includes(q)),
    )
  }, [todosToday, query])

  return (
    <div className="grid grid-2">
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h1>今日のToDo</h1>
          <span className={'badge ' + (overdueCount > 0 ? 'badge-overdue' : '')}>
            {overdueCount > 0 ? `期限切れ ${overdueCount}` : '期限切れなし'}
          </span>
        </div>

        <div style={{ marginTop: 10 }}>
          <input placeholder="検索（タイトル/タグ）" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        {toast && (
          <div style={{ marginTop: 10 }} className="badge">
            {toast}
          </div>
        )}

        <div className="sep" />

        {filteredToday.length === 0 ? (
          <div>
            <p style={{ marginTop: 0 }}>今日やる復習はありません。</p>
            <small>「追加」から新規を登録すると、今日 / 明日のToDoに入れられます。</small>
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
                onMoveDate={(d) => {
                  setData(moveDueDate(data, it.id, d))
                  showToast(`期限を ${d} に変更しました`)
                }}
                onChangeSet={setId => {
                  const items = data.items.map(x => (x.id === it.id ? { ...x, intervalSetId: setId } : x))
                  setData({ ...data, items })
                  showToast('間隔セットを変更しました（次回完了以降に反映）')
                }}
              />
            ))}
          </div>
        )}

        <div className="sep" />

        <details open>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>完了済み（今日）: {completedToday.length}</summary>
          <div style={{ marginTop: 10 }} className="grid">
            {completedToday.length === 0 ? (
              <small>まだありません。</small>
            ) : (
              completedToday.map(it => (
                <CompletedRow
                  key={it.id}
                  item={it}
                  data={data}
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
              <small>「追加」で「明日」を選ぶか、今日のToDoを「明日に回す」してください。</small>
            ) : (
              todosTomorrowExact.map(it => (
                <TomorrowRow
                  key={it.id}
                  item={it}
                  data={data}
                  today={today}
                  onMoveToday={() => {
                    setData(moveDueDate(data, it.id, today))
                    showToast('今日に戻しました')
                  }}
                  onMoveDate={(d) => {
                    setData(moveDueDate(data, it.id, d))
                    showToast(`期限を ${d} に変更しました`)
                  }}
                  onChangeSet={setId => {
                    const items = data.items.map(x => (x.id === it.id ? { ...x, intervalSetId: setId } : x))
                    setData({ ...data, items })
                    showToast('間隔セットを変更しました（次回完了以降に反映）')
                  }}
                />
              ))
            )}
          </div>
        </details>
      </div>

      <div className="card">
        <h2>今日の目安</h2>
        <div className="row-wrap">
          <span className="badge">
            日付：<span className="mono">{today}</span>
          </span>
          <span className="badge">今日ToDo：{todosToday.length}</span>
          <span className="badge">完了：{completedToday.length}</span>
          <span className="badge">明日予定：{todosTomorrowExact.length}</span>
        </div>

        <div className="sep" />
        <h2>ボタンの意味</h2>
        <ul style={{ marginTop: 0, paddingLeft: 18, color: '#333' }}>
          <li>
            <b>完了</b>：復習間隔に従って次回日付を自動設定し、stageを進めます。今日の完了済みリストに残ります。
          </li>
          <li>
            <b>取り消し</b>：直近の完了操作を元に戻します（stage/期限/lastDone）。
          </li>
          <li>
            <b>明日に回す</b>：このタスクの期限（nextDue）だけを明日に動かします（stageは進みません）。
          </li>
          <li>
            <b>日付</b>：カレンダー（date入力）で期限を指定できます（stageは進みません）。
          </li>
          <li>
            <b>やり直し</b>：stageを0に戻し、期限を今日に戻します。完了扱い（lastDone）も消します。
          </li>
          <li>
            <b>間隔</b>：その勉強内容に紐づく「間隔セット」を変更できます（次回完了以降に反映）。
          </li>
        </ul>
        <div className="sep" />
        <small className="muted">「カレンダー」タブでは、日付ごとの予定を一覧できます。</small>
      </div>
    </div>
  )
}

function IntervalPicker({ data, currentId, onChange }: { data: AppData; currentId: string; onChange: (id: string) => void }) {
  return (
    <select value={currentId} onChange={e => onChange(e.target.value)}>
      {data.intervalSets.map(s => (
        <option key={s.id} value={s.id}>
          {s.name}
          {s.isDefault ? '（デフォルト）' : ''} — [{s.intervalsDays.join(', ')}]
        </option>
      ))}
    </select>
  )
}

function DatePicker({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ maxWidth: 170 }}
      aria-label="期限日"
    />
  )
}

function TodoRow(props: {
  item: Item
  data: AppData
  today: string
  tomorrow: string
  onComplete: () => void
  onReset: () => void
  onMoveTomorrow: () => void
  onMoveDate: (d: string) => void
  onChangeSet: (setId: string) => void
}) {
  const { item, data, today, tomorrow, onComplete, onReset, onMoveTomorrow, onMoveDate, onChangeSet } = props
  const set = getSetById(data.intervalSets, item.intervalSetId)
  const overdue = cmpISO(item.nextDue, today) < 0
  const [showDate, setShowDate] = useState(false)

  return (
    <div className="card" style={{ borderColor: overdue ? '#b00020' : undefined }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, wordBreak: 'break-word' }}>{item.title}</div>

          <div className="row-wrap" style={{ marginTop: 6 }}>
            <span className={'badge ' + (overdue ? 'badge-overdue' : '')}>{daysAgoLabel(item.nextDue, today)}</span>

            <details>
              <summary className="badge" style={{ cursor: 'pointer' }}>
                間隔：{set.name}
              </summary>
              <div style={{ marginTop: 8 }}>
                <IntervalPicker data={data} currentId={set.id} onChange={onChangeSet} />
                <div style={{ marginTop: 6 }}>
                  <small>※変更は次回完了以降に反映（予定日は再計算しません）</small>
                </div>
              </div>
            </details>

            <span className="badge">stage：{item.stage}</span>
            <span className="badge">
              次回：<span className="mono">{item.nextDue}</span>
            </span>

            <button className="btn" onClick={() => setShowDate(v => !v)} title="期限日を指定">
              日付
            </button>
            {showDate && <DatePicker value={item.nextDue} onChange={onMoveDate} />}
          </div>

          {item.tags.length > 0 && <div style={{ marginTop: 8 }}>{tagBadges(item.tags)}</div>}

          <div style={{ marginTop: 8 }}>
            <small>最後：{item.lastDone ? item.lastDone : '未完了'}</small>
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={onComplete}>
            完了
          </button>
          <button className="btn" onClick={onMoveTomorrow} title={`期限を${tomorrow}に動かします（stageは進みません）`}>
            明日に回す
          </button>
          <button className="btn" onClick={onReset} title="stageを0に戻し、期限を今日に戻します">
            やり直し
          </button>
        </div>
      </div>
    </div>
  )
}

function CompletedRow({ item, data, onUndo }: { item: Item; data: AppData; onUndo: () => void }) {
  const set = getSetById(data.intervalSets, item.intervalSetId)
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, wordBreak: 'break-word' }}>{item.title}</div>
          <div className="row-wrap" style={{ marginTop: 6 }}>
            <span className="badge">間隔：{set.name}</span>
            <span className="badge">
              次回：<span className="mono">{item.nextDue}</span>
            </span>
            <span className="badge">stage：{item.stage}</span>
          </div>
          {item.tags.length > 0 && <div style={{ marginTop: 8 }}>{tagBadges(item.tags)}</div>}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" disabled={!item.undo} onClick={onUndo} title="直近の完了を取り消します">
            取り消し
          </button>
        </div>
      </div>
    </div>
  )
}

function TomorrowRow(props: {
  item: Item
  data: AppData
  today: string
  onMoveToday: () => void
  onMoveDate: (d: string) => void
  onChangeSet: (setId: string) => void
}) {
  const { item, data, today, onMoveToday, onMoveDate, onChangeSet } = props
  const set = getSetById(data.intervalSets, item.intervalSetId)
  const [showDate, setShowDate] = useState(false)

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, wordBreak: 'break-word' }}>{item.title}</div>
          <div className="row-wrap" style={{ marginTop: 6 }}>
            <details>
              <summary className="badge" style={{ cursor: 'pointer' }}>
                間隔：{set.name}
              </summary>
              <div style={{ marginTop: 8 }}>
                <IntervalPicker data={data} currentId={set.id} onChange={onChangeSet} />
                <div style={{ marginTop: 6 }}>
                  <small>※変更は次回完了以降に反映</small>
                </div>
              </div>
            </details>

            <span className="badge">
              次回：<span className="mono">{item.nextDue}</span>
            </span>

            <button className="btn" onClick={() => setShowDate(v => !v)} title="期限日を指定">
              日付
            </button>
            {showDate && <DatePicker value={item.nextDue} onChange={onMoveDate} />}
          </div>
          {item.tags.length > 0 && <div style={{ marginTop: 8 }}>{tagBadges(item.tags)}</div>}
        </div>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onMoveToday} title={`期限を${today}に戻します`}>
            今日に戻す
          </button>
        </div>
      </div>
    </div>
  )
}
