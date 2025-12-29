import React, { useMemo, useState } from 'react'
import type { AppData, Priority } from '../core/types'
import { createItem } from '../core/storage'
import { todayJST, tomorrowJST } from '../core/date'

function parseLine(line: string): { title: string; tags: string[]; priority?: Priority; targetMinutes?: number | null } | null {
  const raw = line.trim()
  if (!raw) return null

  const parts = raw.split(/\s+/)
  const tags: string[] = []
  let priority: Priority | undefined
  let targetMinutes: number | null | undefined
  const titleParts: string[] = []

  for (const p of parts) {
    if (p.startsWith('#') && p.length > 1) {
      tags.push(p.slice(1))
      continue
    }
    // !1 !2 !3 => priority
    if (/^!([1-3])$/.test(p)) {
      const n = Number(p.slice(1)) as Priority
      priority = n
      continue
    }
    // 30m, 30min, ~30
    if (/^(~?\d+)(m|min)$/i.test(p)) {
      const n = Number(p.replace(/[^0-9]/g, ''))
      if (!Number.isNaN(n)) targetMinutes = n
      continue
    }
    if (/^~\d+$/.test(p)) {
      const n = Number(p.slice(1))
      if (!Number.isNaN(n)) targetMinutes = n
      continue
    }
    titleParts.push(p)
  }

  const title = titleParts.join(' ').trim()
  if (!title) return null
  return { title, tags, priority, targetMinutes }
}

export default function AddView({ data, setData }: { data: AppData; setData: (d: AppData) => void }) {
  const defaultSet = useMemo(() => data.intervalSets.find(s => s.isDefault) ?? data.intervalSets[0], [data.intervalSets])

  const [mode, setMode] = useState<'single' | 'bulk'>('single')

  // single
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [setId, setSetId] = useState<string>(defaultSet.id)
  const [start, setStart] = useState<'today' | 'tomorrow' | 'date'>('today')
  const [date, setDate] = useState<string>(() => todayJST())
  const [priority, setPriority] = useState<Priority>(2)
  const [targetMinutes, setTargetMinutes] = useState<string>('') // allow empty
  const [notes, setNotes] = useState('')

  // bulk
  const [bulkText, setBulkText] = useState('')
  const [bulkTags, setBulkTags] = useState('') // comma tags to apply to all
  const [bulkPriority, setBulkPriority] = useState<Priority>(2)
  const [bulkTargetMinutes, setBulkTargetMinutes] = useState<string>('') // default
  const [bulkNotes, setBulkNotes] = useState('')
  const [bulkStart, setBulkStart] = useState<'today' | 'tomorrow' | 'date'>('today')
  const [bulkDate, setBulkDate] = useState<string>(() => todayJST())

  function startDueFrom(startVal: 'today' | 'tomorrow' | 'date', dateVal: string): string {
    if (startVal === 'today') return todayJST()
    if (startVal === 'tomorrow') return tomorrowJST()
    return dateVal
  }

  function tagListFromComma(s: string): string[] {
    return s
      .split(',')
      .map(x => x.trim())
      .filter(Boolean)
  }

  function onAddSingle() {
    const t = title.trim()
    if (!t) return

    const tagList = tagListFromComma(tags)
    const startDue = startDueFrom(start, date)

    const tm = targetMinutes.trim() ? Number(targetMinutes.trim()) : null
    const item = createItem(
      {
        title: t,
        tags: tagList,
        intervalSetId: setId,
        startDue,
        priority,
        targetMinutes: Number.isFinite(tm as any) ? (tm as any) : null,
        notes,
      },
      data.intervalSets,
    )

    setData({ ...data, items: [item, ...data.items] })
    setTitle('')
    setTags('')
    setNotes('')
    setTargetMinutes('')
    setStart('today')
    location.hash = '#today'
  }

  function onAddBulk() {
    const baseTags = tagListFromComma(bulkTags)
    const startDue = startDueFrom(bulkStart, bulkDate)
    const defaultTm = bulkTargetMinutes.trim() ? Number(bulkTargetMinutes.trim()) : null

    const lines = bulkText.split(/\r?\n/)
    const itemsToAdd = []
    for (const line of lines) {
      const parsed = parseLine(line)
      if (!parsed) continue
      const mergedTags = Array.from(new Set([...baseTags, ...parsed.tags]))
      const pr = parsed.priority ?? bulkPriority
      const tm = parsed.targetMinutes ?? (Number.isFinite(defaultTm as any) ? defaultTm : null)
      const item = createItem(
        {
          title: parsed.title,
          tags: mergedTags,
          intervalSetId: setId,
          startDue,
          priority: pr,
          targetMinutes: tm,
          notes: bulkNotes,
        },
        data.intervalSets,
      )
      itemsToAdd.push(item)
    }
    if (itemsToAdd.length === 0) return
    setData({ ...data, items: [...itemsToAdd.reverse(), ...data.items] })
    setBulkText('')
    setBulkNotes('')
    setBulkTags('')
    setBulkTargetMinutes('')
    location.hash = '#today'
  }

  return (
    <div className="grid">
      <div className="card" style={{ maxWidth: 860 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h1>追加</h1>
          <div className="row" style={{ gap: 8 }}>
            <button className={'btn ' + (mode === 'single' ? 'btn-primary' : '')} onClick={() => setMode('single')}>
              1件
            </button>
            <button className={'btn ' + (mode === 'bulk' ? 'btn-primary' : '')} onClick={() => setMode('bulk')}>
              一括
            </button>
          </div>
        </div>

        <div className="sep" />

        <div className="grid grid-2">
          <div>
            <label>間隔セット</label>
            <select value={setId} onChange={e => setSetId(e.target.value)}>
              {data.intervalSets.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isDefault ? '（デフォルト）' : ''} — [{s.intervalsDays.join(', ')}]
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>開始日（予定）</label>
            <div className="row-wrap">
              <select
                value={mode === 'single' ? start : bulkStart}
                onChange={e => (mode === 'single' ? setStart(e.target.value as any) : setBulkStart(e.target.value as any))}
                style={{ maxWidth: 220 }}
              >
                <option value="today">今日</option>
                <option value="tomorrow">明日</option>
                <option value="date">日付指定</option>
              </select>
              {(mode === 'single' ? start : bulkStart) === 'date' && (
                <input
                  type="date"
                  value={mode === 'single' ? date : bulkDate}
                  onChange={e => (mode === 'single' ? setDate(e.target.value) : setBulkDate(e.target.value))}
                  style={{ maxWidth: 200 }}
                />
              )}
            </div>
          </div>

          <div>
            <label>優先度</label>
            <select value={mode === 'single' ? priority : bulkPriority} onChange={e => (mode === 'single' ? setPriority(Number(e.target.value) as any) : setBulkPriority(Number(e.target.value) as any))}>
              <option value="1">高（1）</option>
              <option value="2">中（2）</option>
              <option value="3">低（3）</option>
            </select>
          </div>

          <div>
            <label>目標時間（分）</label>
            <input
              inputMode="numeric"
              placeholder="例：30"
              value={mode === 'single' ? targetMinutes : bulkTargetMinutes}
              onChange={e => (mode === 'single' ? setTargetMinutes(e.target.value) : setBulkTargetMinutes(e.target.value))}
            />
          </div>
        </div>

        <div className="sep" />

        {mode === 'single' ? (
          <>
            <label>タイトル</label>
            <input
              placeholder="例：工業簿記 標準原価（Enterで追加）"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') onAddSingle()
              }}
            />

            <div style={{ marginTop: 10 }}>
              <label>タグ（カンマ区切り）</label>
              <input placeholder="例：簿記1級,工業簿記" value={tags} onChange={e => setTags(e.target.value)} />
            </div>

            <div style={{ marginTop: 10 }}>
              <label>備考（メモ）</label>
              <textarea rows={4} placeholder="例：解けなかった論点、次にやること、参考ページなど" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            <div className="row" style={{ marginTop: 14, gap: 10 }}>
              <button className="btn btn-primary" onClick={onAddSingle} disabled={title.trim().length === 0}>
                追加
              </button>
              <small className="muted">Enterで追加できます</small>
            </div>
          </>
        ) : (
          <>
            <label>一括追加（1行=1タスク）</label>
            <textarea
              rows={10}
              placeholder={"例：\n工業簿記 標準原価 #工業簿記 !1 ~40\n財務会計 理論 #財務会計 !2 30m\n"}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              onKeyDown={e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') onAddBulk()
              }}
            />
            <small className="muted">
              行内で <span className="mono">#タグ</span>、<span className="mono">!1/!2/!3</span>（優先度）、<span className="mono">~30</span> or <span className="mono">30m</span>（分）を指定できます。Ctrl+Enterで追加。
            </small>

            <div style={{ marginTop: 10 }} className="grid grid-2">
              <div>
                <label>共通タグ（カンマ区切り）</label>
                <input placeholder="例：簿記1級" value={bulkTags} onChange={e => setBulkTags(e.target.value)} />
              </div>
              <div>
                <label>共通の備考</label>
                <input placeholder="例：テキストA / Chapter3" value={bulkNotes} onChange={e => setBulkNotes(e.target.value)} />
              </div>
            </div>

            <div className="row" style={{ marginTop: 14, gap: 10 }}>
              <button className="btn btn-primary" onClick={onAddBulk} disabled={bulkText.trim().length === 0}>
                一括追加
              </button>
              <small className="muted">Ctrl+Enterでも追加できます</small>
            </div>
          </>
        )}
      </div>

      <div className="card" style={{ maxWidth: 860 }}>
        <h2>入力を爆速化するコツ</h2>
        <ul style={{ marginTop: 0, paddingLeft: 18 }}>
          <li>一括追加で、まず「やる内容」を全部貼る → あとでタグ/優先度/時間を足すのが早いです。</li>
          <li>行内記法：<span className="mono">#タグ</span>、<span className="mono">!1</span>（高）、<span className="mono">~30</span>（30分）。</li>
          <li>備考は「次に解くページ」「詰まった点」だけでも残すと復習が楽になります。</li>
        </ul>
      </div>
    </div>
  )
}
