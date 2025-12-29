import React, { useEffect, useState } from 'react'
import type { AppData } from '../core/types'
import { loadData, saveData } from '../core/storage'
import TodayView from './TodayView'
import AddView from './AddView'
import SettingsView from './SettingsView'
import CalendarView from './CalendarView'
import ListView from './ListView'
import TimerView from './TimerView'

type Tab = 'today' | 'add' | 'calendar' | 'list' | 'timer' | 'settings'

function getTabFromHash(): Tab {
  const h = (location.hash || '').replace('#', '')
  if (h === 'add' || h === 'settings' || h === 'calendar' || h === 'list' || h === 'timer') return h
  return 'today'
}

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData())
  const [tab, setTab] = useState<Tab>(() => getTabFromHash())

  useEffect(() => {
    const onHash = () => setTab(getTabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    saveData(data)
  }, [data])

  // Theme
  useEffect(() => {
    const theme = (data as any).ui?.theme ?? 'indigo'
    document.documentElement.dataset.theme = theme
  }, [data.ui?.theme])

  return (
    <>
      <div className="header">
        <div className="header-inner">
          <div className="brand" onClick={() => (location.hash = '#today')} style={{ cursor: 'pointer' }}>
            復習ToDo
          </div>

          <div className="tabs">
            <button className={'tab ' + (tab === 'today' ? 'active' : '')} onClick={() => (location.hash = '#today')}>
              今日
            </button>
            <button className={'tab ' + (tab === 'add' ? 'active' : '')} onClick={() => (location.hash = '#add')}>
              追加
            </button>
            <button className={'tab ' + (tab === 'calendar' ? 'active' : '')} onClick={() => (location.hash = '#calendar')}>
              カレンダー
            </button>
            <button className={'tab ' + (tab === 'list' ? 'active' : '')} onClick={() => (location.hash = '#list')}>
              一覧
            </button>
            <button className={'tab ' + (tab === 'timer' ? 'active' : '')} onClick={() => (location.hash = '#timer')}>
              タイマー
            </button>
            <button className={'tab ' + (tab === 'settings' ? 'active' : '')} onClick={() => (location.hash = '#settings')}>
              設定
            </button>
          </div>
        </div>
      </div>

      <div className="container">
        {tab === 'today' && <TodayView data={data} setData={setData} />}
        {tab === 'add' && <AddView data={data} setData={setData} />}
        {tab === 'calendar' && <CalendarView data={data} setData={setData} />}
        {tab === 'list' && <ListView data={data} setData={setData} />}
        {tab === 'timer' && <TimerView data={data} setData={setData} />}
        {tab === 'settings' && <SettingsView data={data} setData={setData} />}

        <div className="sep" />
        <small style={{ color: 'rgba(255,255,255,.75)' }}>
          データはこのブラウザ内（localStorage）に保存されます。ログインや同期は未実装です。
        </small>
      </div>
    </>
  )
}
