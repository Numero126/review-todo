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
}

export type AppData = {
  intervalSets: IntervalSet[]
  items: Item[]
}
