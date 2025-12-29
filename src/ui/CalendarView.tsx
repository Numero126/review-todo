import React, { useMemo, useState } from 'react'
import type { AppData } from '../core/types'
import { todayJST, cmpISO } from '../core/date'
import { getExactDue, getOverdueOnDate, moveDueDate } from '../core/scheduler'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function addMonths(iso: string, delta: number): string {
  const [y, m] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, 1)
  dt.setMonth(dt.getMonth() + delta)
  return toISO(dt)
}

function monthLabel(ymd: string): string {
  const [y, m] = ymd.split('-').map(Number)
  return `${y}年${m}月`
}

export default function CalendarView({ data, setData }: { data: AppData; setData: (d: AppData) => void }) {
  const today = todayJST()
  const [selected, setSelected] = useState<string>(() => todayJST())
  const [monthAnchor, setMonthAnchor] = useState<string>(() => {
    const [y, m] = today.split('-')
    return `${y}-${m}-01`
  })

  const overdue = useMemo(() => getOverdueOnDate(data, selected), [data, selected])
  const exact = useMemo(() => getExactDue(data, selected), [data, selected])

  const counts = useMemo(() => {
    const exactMap = new Map<string, number>()
    const overdueMap = new Map<string, number>() // tasks with nextDue < date
    for (const it of data.items) {
      exactMap.set(it.nextDue, (exactMap.get(it.nextDue) ?? 0) + 1)
    }
    // For overdueMap, we compute lazily per cell using comparisons (cheap enough)
    return { exactMap, overdueMap }
  }, [data.items])

  const cells = useMemo(() => {
    const [y, m] = monthAnchor.split('-').map(Number)
    const first = new Date(y, m - 1, 1)
    const firstDow = first.getDay() // 0=Sun
    const start = new Date(y, m - 1, 1 - firstDow)
    const arr: { iso: string; inMonth: boolean }[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const iso = toISO(d)
      arr.push({ iso, inMonth: d.getMonth() === (m - 1) })
    }
    return arr
  }, [monthAnchor])

  function overdueCountOn(date: string): number {
    // nextDue < date
    let c = 0
    for (const it of data.items) {
      if (cmpISO(it.nextDue, date) < 0) c++
    }
    return c
  }

  return (
    <div className="grid grid-2">
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
          <h1>カレンダー</h1>
          <span className="badge">月表示（グリッド）</span>
        </div>

        <div className="sep" />

        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => setMonthAnchor(addMonths(monthAnchor, -1))}>←</button>
            <div style={{ fontWeight: 900 }}>{monthLabel(monthAnchor)}</div>
            <button className="btn" onClick={() => setMonthAnchor(addMonths(monthAnchor, +1))}>→</button>
          </div>

          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => { setSelected(today); setMonthAnchor(`${today.slice(0,7)}-01`) }}>今日へ</button>
            <input type="date" value={selected} onChange={e => { setSelected(e.target.value); setMonthAnchor(`${e.target.value.slice(0,7)}-01`) }} />
          </div>
        </div>

        <div className="sep" />

        <div className="calendar-head">
          {['日','月','火','水','木','金','土'].map(w => (
            <div key={w} style={{ padding: '0 6px' }}>{w}</div>
          ))}
        </div>

        <div className="calendar-grid" style={{ marginTop: 8 }}>
          {cells.map(c => {
            const ex = counts.exactMap.get(c.iso) ?? 0
            const od = overdueCountOn(c.iso)
            const cls =
              'cal-cell' +
              (c.inMonth ? '' : ' muted') +
              (c.iso === selected ? ' selected' : '') +
              (c.iso === today ? ' today' : '')
            return (
              <div
                key={c.iso}
                className={cls}
                onClick={() => setSelected(c.iso)}
                title={`${c.iso}：期限 ${ex} / 期限切れ ${od}`}
              >
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="cal-day">{Number(c.iso.slice(-2))}</div>
                  {ex > 0 ? <span className="badge">期限 {ex}</span> : null}
                </div>
                <div className="cal-count">
                  {od > 0 ? <span className="badge badge-overdue">期限切れ {od}</span> : <span className="muted" style={{ fontSize: 12 }}>—</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
          <h2 style={{ marginTop: 0 }}>選択日：{selected}</h2>
          <span className="badge">期限 {exact.length} / 期限切れ {overdue.length}</span>
        </div>

        <details open>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>期限切れ（この日までにやる）</summary>
          {overdue.length === 0 ? (
            <small className="muted">ありません。</small>
          ) : (
            <div className="grid" style={{ marginTop: 10 }}>
              {overdue.map(it => (
                <div key={it.id} className="card" style={{ borderColor: '#b00020' }}>
                  <div style={{ fontWeight: 800, wordBreak: 'break-word' }}>{it.title}</div>
                  <div className="row-wrap" style={{ marginTop: 8 }}>
                    <span className="badge badge-overdue">期限：{it.nextDue}</span>
                    <button className="btn" onClick={() => setData(moveDueDate(data, it.id, selected))} title="この日に移動します">
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
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>期限がこの日（{exact.length}）</summary>
          {exact.length === 0 ? (
            <small className="muted">ありません。</small>
          ) : (
            <div className="grid" style={{ marginTop: 10 }}>
              {exact.map(it => (
                <div key={it.id} className="card">
                  <div style={{ fontWeight: 800, wordBreak: 'break-word' }}>{it.title}</div>
                  <div className="row-wrap" style={{ marginTop: 8 }}>
                    <button className="btn" onClick={() => (location.hash = '#timer')}>タイマーへ</button>
                    <button className="btn" onClick={() => setData(moveDueDate(data, it.id, today))}>今日へ</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </details>
      </div>
    </div>
  )
}
