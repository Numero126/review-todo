import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { AppData } from '../core/types'
import { todayJST, cmpISO } from '../core/date'
import { completeItem, getTodosForDate, moveDueDate } from '../core/scheduler'

type Mode = 'pomodoro' | 'timer'
type Phase = 'work' | 'break' | 'long'

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

export default function TimerView({ data, setData }: { data: AppData; setData: (d: AppData) => void }) {
  const today = todayJST()

  const todosToday = useMemo(() => getTodosForDate(data, today), [data, today])
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return todosToday.slice(0, 50)
    return todosToday.filter(it => (it.title + ' ' + it.tags.join(' ') + ' ' + (it.notes ?? '')).toLowerCase().includes(q)).slice(0, 50)
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
  const [doneWorkCount, setDoneWorkCount] = useState(0)

  // timer runtime (non-pomodoro)
  const [timerMin, setTimerMin] = useState(30)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerRemaining, setTimerRemaining] = useState(timerMin * 60)

  const tickRef = useRef<number | null>(null)

  // keep remaining in sync when settings change (if not running)
  useEffect(() => {
    if (!running && phase === 'work') setRemaining(workMin * 60)
    if (!running && phase === 'break') setRemaining(breakMin * 60)
    if (!running && phase === 'long') setRemaining(longBreakMin * 60)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workMin, breakMin, longBreakMin])

  useEffect(() => {
    if (!timerRunning) setTimerRemaining(timerMin * 60)
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
        setRemaining(prev => prev - 1)
      } else {
        setTimerRemaining(prev => prev - 1)
      }
    }, 1000)

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [mode, running, timerRunning])

  // phase transitions
  useEffect(() => {
    if (!running) return
    if (remaining > 0) return

    // phase ended
    if (phase === 'work') {
      const nextDone = doneWorkCount + 1
      setDoneWorkCount(nextDone)
      if (nextDone % cycles === 0) {
        setPhase('long')
        setRemaining(longBreakMin * 60)
      } else {
        setPhase('break')
        setRemaining(breakMin * 60)
      }
    } else {
      setPhase('work')
      setRemaining(workMin * 60)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, running])

  // timer end
  useEffect(() => {
    if (!timerRunning) return
    if (timerRemaining > 0) return
    setTimerRunning(false)
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
    setRemaining(workMin * 60)
  }

  function startTimer() {
    setTimerRunning(true)
  }
  function pauseTimer() {
    setTimerRunning(false)
  }
  function resetTimer() {
    setTimerRunning(false)
    setTimerRemaining(timerMin * 60)
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
          <div style={{ marginTop: 10 }}>
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

            <div className="row" style={{ marginTop: 12, gap: 10 }}>
              {!running ? (
                <button className="btn btn-primary" onClick={startPomodoro}>開始</button>
              ) : (
                <button className="btn btn-primary" onClick={pausePomodoro}>一時停止</button>
              )}
              <button className="btn" onClick={resetPomodoro}>リセット</button>
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
            <small className="muted">※今は通知音なしです（次で追加できます）。</small>
          </>
        ) : (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ marginTop: 0 }}>非ポモドーロ（カウントダウン）</h2>
              <span className="badge">自由に時間を設定</span>
            </div>

            <div className="timer-big">{fmt(timerRemaining)}</div>

            <div className="row" style={{ marginTop: 12, gap: 10 }}>
              {!timerRunning ? (
                <button className="btn btn-primary" onClick={startTimer}>開始</button>
              ) : (
                <button className="btn btn-primary" onClick={pauseTimer}>一時停止</button>
              )}
              <button className="btn" onClick={resetTimer}>リセット</button>
            </div>

            <div className="sep" />

            <label>時間（分）</label>
            <input inputMode="numeric" value={timerMin} onChange={e => setTimerMin(Math.max(1, Number(e.target.value || 1)))} />
            <small className="muted">タスクの「目標時間」を見ながら、好きな時間で集中できます。</small>
          </>
        )}
      </div>
    </div>
  )
}
