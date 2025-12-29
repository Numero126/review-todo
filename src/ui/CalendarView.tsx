import React, { useMemo, useState } from 'react'
import type { AppData } from '../core/types'
import { todayJST } from '../core/date'
import { getExactDue, getOverdueOnDate, moveDueDate } from '../core/scheduler'

export default function CalendarView({ data, setData }: { data: AppData; setData: (d: AppData) => void }) {
  const [date, setDate] = useState<string>(() => todayJST())
  const overdue = useMemo(() => getOverdueOnDate(data, date), [data, date])
  const exact = useMemo(() => getExactDue(data, date), [data, date])

  return (
    <div className="grid grid-2">
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h1>カレンダー</h1>
          <span className="badge">日付を選んで予定を見ます</span>
        </div>

        <div className="sep" />

        <div style={{ maxWidth: 240 }}>
          <label>日付</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <div className="sep" />

        <details open>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>その日までの未消化（期限切れ）: {overdue.length}</summary>
          <div className="sep" />
          {overdue.length === 0 ? (
            <small className="muted">期限切れはありません。</small>
          ) : (
            <div className="grid">
              {overdue.map(it => (
                <div key={it.id} className="card" style={{ borderColor: '#b00020' }}>
                  <div style={{ fontWeight: 700, wordBreak: 'break-word' }}>{it.title}</div>
                  <div className="row-wrap" style={{ marginTop: 8 }}>
                    <span className="badge badge-overdue">期限：{it.nextDue}</span>
                    <button className="btn" onClick={() => setData(moveDueDate(data, it.id, date))} title="この日に移動します">
                      この日に移動
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </details>

        <div className="sep" />

        <details open>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>その日の予定（nextDue=当日）: {exact.length}</summary>
          <div className="sep" />
          {exact.length === 0 ? (
            <small className="muted">予定がありません。「一覧」や「今日」から日付を動かして追加できます。</small>
          ) : (
            <div className="grid">
              {exact.map(it => (
                <div key={it.id} className="card">
                  <div style={{ fontWeight: 700, wordBreak: 'break-word' }}>{it.title}</div>
                  <div className="row-wrap" style={{ marginTop: 8 }}>
                    <span className="badge">期限：{it.nextDue}</span>
                    <button className="btn" onClick={() => setData(moveDueDate(data, it.id, todayJST()))} title="今日に戻します">
                      今日に戻す
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </details>
      </div>

      <div className="card">
        <h2>使い方</h2>
        <ul style={{ marginTop: 0, paddingLeft: 18 }}>
          <li>日付を選ぶと、その日の予定（<span className="mono">nextDue=選択日</span>）が見られます。</li>
          <li>期限切れタスクを「この日に移動」でまとめてリスケできます（stageは進みません）。</li>
          <li>日付の調整は「今日」画面の <b>日付</b> ボタンや、「一覧」からもできます。</li>
        </ul>
        <div className="sep" />
        <small className="muted">※「その日までにやる」は今日画面のToDo（nextDue ≤ 今日）で管理します。</small>
      </div>
    </div>
  )
}
