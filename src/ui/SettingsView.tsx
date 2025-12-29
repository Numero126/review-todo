import React, { useMemo, useState } from 'react'
import type { AppData, IntervalSet } from '../core/types'
import { todayJST } from '../core/date'
import { uid } from '../core/id'
import { parseIntervals } from '../core/validate'

function serializeIntervals(arr: number[]): string {
  return arr.length === 0 ? 'なし' : arr.join(', ')
}

export default function SettingsView({ data, setData }: { data: AppData; setData: (d: AppData) => void }) {
  const [error, setError] = useState<string | null>(null)

  const defaultId = useMemo(() => (data.intervalSets.find(s => s.isDefault)?.id ?? data.intervalSets[0].id), [data.intervalSets])

  function updateSet(id: string, patch: Partial<IntervalSet>) {
    setError(null)
    setData({
      ...data,
      intervalSets: data.intervalSets.map(s => (s.id === id ? { ...s, ...patch } : s)),
    })
  }

  function setDefault(id: string) {
    setError(null)
    setData({
      ...data,
      intervalSets: data.intervalSets.map(s => ({ ...s, isDefault: s.id === id })),
    })
  }

  function addSet() {
    setError(null)
    const t = todayJST()
    const newSet: IntervalSet = {
      id: uid('set'),
      name: '新しい間隔セット',
      intervalsDays: [1, 2, 4, 7],
      isDefault: false,
      createdAt: t,
    }
    setData({ ...data, intervalSets: [...data.intervalSets, newSet] })
  }

  function removeSet(id: string) {
    setError(null)
    if (id === defaultId) {
      setError('デフォルトのセットは削除できません。先に別のセットをデフォルトにしてください。')
      return
    }
    // Prevent deletion if items use it
    const used = data.items.some(it => it.intervalSetId === id)
    if (used) {
      setError('このセットを使っている勉強内容があります。先に勉強内容側のセットを変更してください。')
      return
    }
    setData({ ...data, intervalSets: data.intervalSets.filter(s => s.id !== id) })
  }

  function onChangeIntervals(id: string, input: string) {
    try {
      const intervals = parseIntervals(input)
      updateSet(id, { intervalsDays: intervals })
    } catch (e: any) {
      setError(e?.message ?? '入力が不正です。')
    }
  }

  return (
    <div className="grid" style={{maxWidth:980}}>
      <div className="card">
        <div className="row" style={{justifyContent:'space-between'}}>
          <h1>復習間隔セット</h1>
          <button className="btn" onClick={addSet}>+ 追加</button>
        </div>
        <div style={{marginTop:8}}>
          <small>
            間隔は「日数」です。空欄/「なし」にすると <b>復習なし</b>（単発タスク向け）になります。変更は <b>次回完了以降</b> に反映されます（既存の予定日は再計算しません）。
          </small>
        </div>
        {error && (
          <div style={{marginTop:10}} className="badge badge-overdue">
            {error}
          </div>
        )}

        <div className="sep" />

        <div className="grid">
          {data.intervalSets.map(s => (
            <SetCard
              key={s.id}
              set={s}
              isDefault={s.id === defaultId}
              onDefault={() => setDefault(s.id)}
              onRename={(name) => updateSet(s.id, { name })}
              onIntervals={(txt) => onChangeIntervals(s.id, txt)}
              onDelete={() => removeSet(s.id)}
            />
          ))}
        </div>
      </div>

      <div className="card">
        <h2>ヒント</h2>
        <ul style={{marginTop:0, paddingLeft:18}}>
          <li>暗記系は短め（例：<span className="mono">[1,2,4,7,14,30]</span>）が相性良いです。</li>
          <li>理解系は長め（例：<span className="mono">[2,4,7,14,30,60,120]</span>）でOKです。</li>
          <li>勉強内容ごとの割り当ては「追加」画面のプルダウンで選びます。</li>
        </ul>
      </div>
    </div>
  )
}

function SetCard(props: {
  set: IntervalSet
  isDefault: boolean
  onDefault: () => void
  onRename: (name: string) => void
  onIntervals: (txt: string) => void
  onDelete: () => void
}) {
  const { set, isDefault, onDefault, onRename, onIntervals, onDelete } = props
  const [intervalText, setIntervalText] = useState(serializeIntervals(set.intervalsDays))

  // keep local text in sync when data changes elsewhere
  React.useEffect(() => setIntervalText(serializeIntervals(set.intervalsDays)), [set.intervalsDays])

  return (
    <div className="card">
      <div className="row" style={{justifyContent:'space-between'}}>
        <div className="row" style={{gap:10}}>
          <span className="badge">{isDefault ? 'デフォルト' : 'セット'}</span>
          <input
            value={set.name}
            onChange={e => onRename(e.target.value)}
            style={{maxWidth:280}}
            aria-label="セット名"
          />
        </div>

        <div className="row" style={{gap:8}}>
          {!isDefault && <button className="btn" onClick={onDefault}>デフォルトにする</button>}
          <button className="btn btn-danger" onClick={onDelete}>削除</button>
        </div>
      </div>

      <div style={{marginTop:12}}>
        <label>復習間隔（日）</label>
        <input
          className="mono"
          value={intervalText}
          onChange={e => setIntervalText(e.target.value)}
          onBlur={() => onIntervals(intervalText)}
          placeholder="例：1, 2, 4, 7, 14, 30, 60"
        />
        <div style={{marginTop:6}}>
          <small>カンマ区切り or 空白区切りで入力できます。保存はフォーカスが外れたとき（onBlur）です。</small>
        </div>
      </div>
    </div>
  )
}
