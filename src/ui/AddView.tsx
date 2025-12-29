import React, { useMemo, useState } from 'react'
import type { AppData } from '../core/types'
import { createItem } from '../core/storage'
import { todayJST, tomorrowJST } from '../core/date'

export default function AddView({ data, setData }: { data: AppData; setData: (d: AppData) => void }) {
  const defaultSet = useMemo(() => data.intervalSets.find(s => s.isDefault) ?? data.intervalSets[0], [data.intervalSets])

  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [setId, setSetId] = useState<string>(defaultSet.id)
  const [start, setStart] = useState<'today' | 'tomorrow'>('today')

  const canSave = title.trim().length > 0

  function onAdd() {
    if (!canSave) return
    const tagList = tags
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    const startDue = start === 'today' ? todayJST() : tomorrowJST()
    const item = createItem({ title: title.trim(), tags: tagList, intervalSetId: setId, startDue }, data.intervalSets)
    setData({ ...data, items: [item, ...data.items] })
    setTitle('')
    setTags('')
    setStart('today')
    location.hash = '#today'
  }

  return (
    <div className="card" style={{maxWidth:720}}>
      <h1>勉強内容の追加</h1>
      <div className="sep" />

      <div style={{marginBottom:12}}>
        <label>タイトル（論点/範囲）</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="例：簿記1級 工業簿記：標準原価差異" />
      </div>

      <div style={{marginBottom:12}}>
        <label>タグ（任意、カンマ区切り）</label>
        <input value={tags} onChange={e => setTags(e.target.value)} placeholder="例：簿記1級, 工業簿記, テキストA" />
      </div>

      <div style={{marginBottom:12}}>
        <label>復習間隔セット</label>
        <select value={setId} onChange={e => setSetId(e.target.value)}>
          {data.intervalSets.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}{s.isDefault ? '（デフォルト）' : ''} — [{s.intervalsDays.join(', ')}]
            </option>
          ))}
        </select>
      </div>

      <div style={{marginBottom:16}}>
        <label>いつやる？</label>
        <div className="row-wrap">
          <button type="button" className={"btn " + (start === 'today' ? 'btn-primary' : '')} onClick={() => setStart('today')}>
            今日
          </button>
          <button type="button" className={"btn " + (start === 'tomorrow' ? 'btn-primary' : '')} onClick={() => setStart('tomorrow')}>
            明日
          </button>
        </div>
        <div style={{marginTop:6}}>
          <small>「明日」を選ぶと、明日のToDo（予定）に入ります。</small>
        </div>
      </div>

      <div className="row" style={{justifyContent:'flex-end'}}>
        <button className="btn btn-primary" disabled={!canSave} onClick={onAdd}>追加する</button>
      </div>
    </div>
  )
}
