export type ISODate = string // "YYYY-MM-DD" (JSTの日付だけを扱う)

export type IntervalSet = {
  id: string
  name: string
  intervalsDays: number[]
  isDefault: boolean
  createdAt: ISODate
}

export type UndoSnapshot = {
  stage: number
  nextDue: ISODate
  lastDone: ISODate | null
}

export type Priority = 1 | 2 | 3 // 1=高,2=中,3=低

export type Item = {
  id: string
  title: string
  tags: string[]
  stage: number // 次に使うintervalのindex（0→intervals[0]=1日後…）
  nextDue: ISODate
  lastDone: ISODate | null // 最後に完了した日（完了済み表示に使う）
  createdAt: ISODate
  intervalSetId: string | null // null => default
  undo?: UndoSnapshot // 直近の完了を「取り消し」するためのスナップショット（任意）

  // v4: 計画/メモ
  priority: Priority
  targetMinutes: number | null
  notes: string
}

export type ThemeName = 'indigo' | 'ocean' | 'forest' | 'sunset' | 'mono'

export type TimerMode = 'pomodoro' | 'timer'

export type TimerSession = {
  id: string
  date: ISODate
  mode: TimerMode
  taskId: string | null
  minutes: number
  createdAt: number // epoch ms (for ordering)
}

export type AppData = {
  intervalSets: IntervalSet[]
  items: Item[]
  sessions: TimerSession[]
  ui: { theme: ThemeName }
}
