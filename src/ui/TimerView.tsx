import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { AppData, TimerMode, TimerSession } from '../core/types'
import { todayJST, cmpISO } from '../core/date'
import { uid } from '../core/id'
import { completeItem, getTodosForDate, moveDueDate } from '../core/scheduler'

type Mode = TimerMode
type Phase = 'work' | 'break' | 'long'

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

function isoDaysBack(n: number): string[] {
  const today = todayJST()
  const [y, m, d] = today.split('-').map(Number)
  const base = new Date(y, m - 1, d)
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(base)
    dt.setDate(base.getDate() - i)
    const yy = dt.getFullYear()
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const dd = String(dt.getDate()).padStart(2, '0')
    out.push(`${yy}-${mm}-${dd}`)
  }
  return out
}

export default function TimerView({ data, setData }: { data: AppData; setData: (d: AppData) => void }) {
  const today = todayJST()

  const todosToday = useMemo(() => getTodosForDate(data, today), [data, today])

  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const src = todosToday
    if (!q) return src.slice(0, 80)
    return src
      .filter(it => (it.title + ' ' + it.tags.join(' ') + ' ' + (it.notes ?? '')).toLowerCase().includes(q))
      .slice(0, 80)
  }, [query, todosToday])

  const [taskId, setTaskId] = useState<string>(() => filtered[0]?.id ?? '')
  const task = useMemo(() => data.items.find(it => it.id === taskId) ?? null, [data.items, taskId])

  // mode
  const [mode, setMode] = useState<Mode>('pomodoro')

  // pomodoro settings
  const [workMin, setWorkMin] = useState(25)
  const [breakMin, setBreakMin] = useState(5)
  const [longBreakMin, setLongBreakMin] = useState(15)
  const [cycles, setCycles] = useState(4)

  // pomodoro runtime
  const [phase, setPhase] = useState<Phase>('work')
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(workMin * 60)
  const [phaseTotal, setPhaseTotal] = useState(workMin * 60)
  const [doneWorkCount, setDoneWorkCount] = useState(0)

  // timer runtime (non-pomodoro)
  const [timerMin, setTimerMin] = useState(30)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerRemaining, setTimerRemaining] = useState(timerMin * 60)
  const [timerTotal, setTimerTotal] = useState(timerMin * 60)

  const tickRef = useRef<number | null>(null)

  function pushSession(minutes: number, mode: Mode, taskId: string | null) {
    const mins = Math.round(Math.max(0, minutes) * 10) / 10
    if (mins < 1) return // 1分未満は無視
    const sess: TimerSession = {
      id: uid('sess'),
      date: today,
      mode,
      taskId,
      minutes: mins,
      createdAt: Date.now(),
    }
    setData({ ...data, sessions: [...(data.sessions ?? []), sess] })
  }

  // keep remaining in sync when settings change (if not running)
  useEffect(() => {
    if (!running && phase === 'work') {
      setRemaining(workMin * 60)
      setPhaseTotal(workMin * 60)
    }
    if (!running && phase === 'break') {
      setRemaining(breakMin * 60)
      setPhaseTotal(breakMin * 60)
    }
    if (!running && phase === 'long') {
      setRemaining(longBreakMin * 60)
      setPhaseTotal(longBreakMin * 60)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workMin, breakMin, longBreakMin])

  useEffect(() => {
    if (!timerRunning) {
      setTimerRemaining(timerMin * 60)
      setTimerTotal(timerMin * 60)
    }
  }, [timerMin, timerRunning])

  // ticker
  useEffect(() => {
    const anyRunning = mode === 'pomodoro' ? running : timerRunning
    if (!anyRunning) {
      if (tickRef.current) window.clearInterval(tickRef.current)
      tickRef.current = null
      return
    }
    if (tickRef.current) return

    tickRef.current = window.setInterval(() => {
      if (mode === 'pomodoro') {
        setRemaining(prev => Math.max(0, prev - 1))
      } else {
        setTimerRemaining(prev => Math.max(0, prev - 1))
      }
    }, 1000)

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [mode, running, timerRunning])

  // pomodoro phase transitions + logging
  useEffect(() => {
    if (!running) return
    if (remaining > 0) return

    // phase ended
    if (phase === 'work') {
      // log one work session
      pushSession(workMin, 'pomodoro', task ? task.id : null)

      const nextDone = doneWorkCount + 1
      setDoneWorkCount(nextDone)

      if (nextDone % cycles === 0) {
        setPhase('long')
        setPhaseTotal(longBreakMin * 60)
        setRemaining(longBreakMin * 60)
      } else {
        setPhase('break')
        setPhaseTotal(breakMin * 60)
        setRemaining(breakMin * 60)
      }
    } else {
      setPhase('work')
      setPhaseTotal(workMin * 60)
      setRemaining(workMin * 60)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, running])

  // timer end + logging
  useEffect(() => {
    if (!timerRunning) return
    if (timerRemaining > 0) return
    setTimerRunning(false)
    pushSession(timerTotal / 60, 'timer', task ? task.id : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerRemaining, timerRunning])

  function startPomodoro() {
    setRunning(true)
  }
  function pausePomodoro() {
    setRunning(false)
  }
  function resetPomodoro() {
    setRunning(false)
    setDoneWorkCount(0)
    setPhase('work')
    setPhaseTotal(workMin * 60)
    setRemaining(workMin * 60)
  }

  function recordAndStopPomodoro() {
    if (phase !== 'work') {
      setRunning(false)
      return
    }
    const elapsed = Math.max(0, phaseTotal - remaining)
    pushSession(elapsed / 60, 'pomodoro', task ? task.id : null)
    setRunning(false)
    setPhase('work')
    setPhaseTotal(workMin * 60)
    setRemaining(workMin * 60)
  }

  function startTimer() {
    setTimerTotal(timerRemaining) // start時の残りを全体として扱う
    setTimerRunning(true)
  }
  function pauseTimer() {
    setTimerRunning(false)
  }
  function resetTimer() {
    setTimerRunning(false)
    setTimerRemaining(timerMin * 60)
    setTimerTotal(timerMin * 60)
  }

  function recordAndStopTimer() {
    const elapsed = Math.max(0, timerTotal - timerRemaining)
    pushSession(elapsed / 60, 'timer', task ? task.id : null)
    setTimerRunning(false)
    setTimerRemaining(timerMin * 60)
    setTimerTotal(timerMin * 60)
  }

  function focusToday() {
    if (!task) return
    if (cmpISO(task.nextDue, today) <= 0) return
    setData(moveDueDate(data, task.id, today))
  }

  function completeNow() {
    if (!task) return
    setData(completeItem(data, task.id, today))
  }

  // Stats
  const recentDays = useMemo(() => isoDaysBack(7), [])
  const stats = useMemo(() => {
    const byDay = new Map<string, number>()
    const byTask = new Map<string, number>()
    for (const d of recentDays) byDay.set(d, 0)

    for (const s of data.sessions ?? []) {
      if (byDay.has(s.date)) byDay.set(s.date, (byDay.get(s.date) ?? 0) + s.minutes)
      if (s.taskId) byTask.set(s.taskId, (byTask.get(s.taskId) ?? 0) + s.minutes)
    }

    const todayMin = byDay.get(today) ?? 0
    const weekMin = recentDays.reduce((sum, d) => sum + (byDay.get(d) ?? 0), 0)
    const topTasks = Array.from(byTask.entries())
      .map(([id, mins]) => ({ id, mins }))
      .sort((a, b) => b.mins - a.mins)
      .slice(0, 8)
      .map(x => ({
        ...x,
        title: data.items.find(it => it.id === x.id)?.title ?? '(削除済みタスク)',
      }))

    const daySeries = recentDays.map(d => ({ date: d, mins: Math.round((byDay.get(d) ?? 0) * 10) / 10 }))

    const recentSessions = [...(data.sessions ?? [])]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20)
      .map(s => ({
        ...s,
        title: s.taskId ? data.items.find(it => it.id === s.taskId)?.title ?? '(削除済みタスク)' : '(未指定)',
      }))

    return { todayMin, weekMin, daySeries, topTasks, recentSessions }
  }, [data.sessions, data.items, recentDays, today])

  return (
    <div className="grid grid-2">
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
          <h1>タイマー</h1>
          <div className="row" style={{ gap: 8 }}>
            <button className={'btn ' + (mode === 'pomodoro' ? 'btn-primary' : '')} onClick={() => { setMode('pomodoro'); setTimerRunning(false) }}>
              ポモドーロ
            </button>
            <button className={'btn ' + (mode === 'timer' ? 'btn-primary' : '')} onClick={() => { setMode('timer'); setRunning(false) }}>
              非ポモドーロ
            </button>
          </div>
        </div>

        <div className="sep" />

        <label>取り組むタスク（今日まで）</label>
        <input placeholder="検索（タイトル/タグ/備考）" value={query} onChange={e => setQuery(e.target.value)} />
        <select value={taskId} onChange={e => setTaskId(e.target.value)} style={{ marginTop: 8 }}>
          {filtered.length === 0 ? (
            <option value="">（該当なし）</option>
          ) : (
            filtered.map(it => (
              <option key={it.id} value={it.id}>
                {it.title}（期限 {it.nextDue} / 優先 {(it.priority ?? 2)} / {(it.targetMinutes ?? '-') }分）
              </option>
            ))
          )}
        </select>

        {task ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900, wordBreak: 'break-word' }}>{task.title}</div>
            <div className="row-wrap" style={{ marginTop: 8 }}>
              <span className={'badge ' + (cmpISO(task.nextDue, today) < 0 ? 'badge-overdue' : '')}>期限：{task.nextDue}</span>
              {task.targetMinutes != null ? <span className="badge">目標 {task.targetMinutes}分</span> : null}
              <button className="btn" onClick={focusToday}>今日のToDoにする</button>
              <button className="btn btn-primary" onClick={completeNow}>完了にする</button>
            </div>
            {task.notes ? (
              <div style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>
                <small className="muted">備考：</small>
                <div>{task.notes}</div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="card">
        {mode === 'pomodoro' ? (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ marginTop: 0 }}>ポモドーロ</h2>
              <span className="badge">Phase: {phase === 'work' ? '作業' : phase === 'break' ? '休憩' : '長休憩'}</span>
            </div>

            <div className="timer-big">{fmt(remaining)}</div>
            <div className="row-wrap" style={{ marginTop: 10 }}>
              <span className="badge">作業完了: {doneWorkCount}</span>
              <span className="badge">長休憩まで: {Math.max(0, cycles - (doneWorkCount % cycles))}</span>
            </div>

            <div className="row-wrap" style={{ marginTop: 12, gap: 10 }}>
              {!running ? (
                <button className="btn btn-primary" onClick={startPomodoro}>開始</button>
              ) : (
                <button className="btn btn-primary" onClick={pausePomodoro}>一時停止</button>
              )}
              <button className="btn" onClick={resetPomodoro}>リセット</button>
              <button className="btn" onClick={recordAndStopPomodoro} title="作業中なら、ここまでを履歴に残して停止します">
                記録して停止
              </button>
            </div>

            <div className="sep" />

            <h3 style={{ marginTop: 0 }}>設定</h3>
            <div className="grid grid-2">
              <div>
                <label>作業（分）</label>
                <input inputMode="numeric" value={workMin} onChange={e => setWorkMin(Number(e.target.value || 0))} />
              </div>
              <div>
                <label>休憩（分）</label>
                <input inputMode="numeric" value={breakMin} onChange={e => setBreakMin(Number(e.target.value || 0))} />
              </div>
              <div>
                <label>長休憩（分）</label>
                <input inputMode="numeric" value={longBreakMin} onChange={e => setLongBreakMin(Number(e.target.value || 0))} />
              </div>
              <div>
                <label>長休憩までの回数</label>
                <input inputMode="numeric" value={cycles} onChange={e => setCycles(Math.max(1, Number(e.target.value || 1)))} />
              </div>
            </div>
            <small className="muted">※完了した作業フェーズは自動で履歴に記録されます。</small>
          </>
        ) : (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ marginTop: 0 }}>非ポモドーロ（カウントダウン）</h2>
              <span className="badge">自由に時間を設定</span>
            </div>

            <div className="timer-big">{fmt(timerRemaining)}</div>

            <div className="row-wrap" style={{ marginTop: 12, gap: 10 }}>
              {!timerRunning ? (
                <button className="btn btn-primary" onClick={startTimer}>開始</button>
              ) : (
                <button className="btn btn-primary" onClick={pauseTimer}>一時停止</button>
              )}
              <button className="btn" onClick={resetTimer}>リセット</button>
              <button className="btn" onClick={recordAndStopTimer} title="ここまでの経過を履歴に残して停止します">
                記録して停止
              </button>
            </div>

            <div className="sep" />

            <label>時間（分）</label>
            <input inputMode="numeric" value={timerMin} onChange={e => setTimerMin(Math.max(1, Number(e.target.value || 1)))} />
            <small className="muted">※0になると自動で履歴に記録されます。</small>
          </>
        )}

        <div className="sep" />

        <h3 style={{ marginTop: 0 }}>履歴と統計（直近7日）</h3>
        <div className="row-wrap">
          <span className="badge">今日: {Math.round(stats.todayMin)}分</span>
          <span className="badge">7日合計: {Math.round(stats.weekMin)}分</span>
        </div>

        <div className="sep" />

        <div className="grid">
          <div>
            <label>日別</label>
            <div className="grid" style={{ gap: 8 }}>
              {stats.daySeries.map(d => (
                <div key={d.date} className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted mono">{d.date}</span>
                  <span className="badge">{Math.round(d.mins)}分</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label>タスク別（上位）</label>
            {stats.topTasks.length === 0 ? (
              <small className="muted">まだ記録がありません。</small>
            ) : (
              <div className="grid" style={{ gap: 8 }}>
                {stats.topTasks.map(t => (
                  <div key={t.id} className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.title}
                    </span>
                    <span className="badge">{Math.round(t.mins)}分</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label>最近の履歴</label>
            {stats.recentSessions.length === 0 ? (
              <small className="muted">まだ記録がありません。</small>
            ) : (
              <div className="grid" style={{ gap: 8 }}>
                {stats.recentSessions.map(s => (
                  <div key={s.id} className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                      <small className="muted mono">{s.date} / {s.mode === 'pomodoro' ? 'ポモドーロ' : '非ポモドーロ'}</small>
                    </div>
                    <span className="badge">{Math.round(s.minutes)}分</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
