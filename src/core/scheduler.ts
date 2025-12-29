import type { AppData, Item, ISODate } from './types'
import { addDaysISO, cmpISO, todayJST } from './date'
import { getSetById } from './storage'

export function getTodosForDate(data: AppData, date: ISODate): Item[] {
  // "その日までにやる" = nextDue <= date
  return data.items
    .filter(it => cmpISO(it.nextDue, date) <= 0)
    .sort((a, b) => cmpISO(a.nextDue, b.nextDue))
}

export function getExactDue(data: AppData, date: ISODate): Item[] {
  return data.items
    .filter(it => it.nextDue === date)
    .sort((a, b) => a.title.localeCompare(b.title, 'ja'))
}

export function getOverdueOnDate(data: AppData, date: ISODate): Item[] {
  return data.items
    .filter(it => cmpISO(it.nextDue, date) < 0)
    .sort((a, b) => cmpISO(a.nextDue, b.nextDue))
}

export function getTodayTodos(data: AppData, date: ISODate = todayJST()): Item[] {
  return getTodosForDate(data, date)
}

export function getCompletedOnDate(data: AppData, date: ISODate): Item[] {
  return data.items
    .filter(it => it.lastDone === date)
    .sort((a, b) => a.title.localeCompare(b.title, 'ja'))
}

export function completeItem(data: AppData, itemId: string, date: ISODate = todayJST()): AppData {
  const items = data.items.map(it => {
    if (it.id !== itemId) return it
    const set = getSetById(data.intervalSets, it.intervalSetId)
    const intervals = set.intervalsDays

    // 復習なし：完了したら次回予定を作らない（単発タスク用）
    if (!intervals || intervals.length === 0) {
      return {
        ...it,
        undo: { stage: it.stage, nextDue: it.nextDue, lastDone: it.lastDone },
        lastDone: date,
        nextDue: '9999-12-31',
        stage: 0,
      }
    }

    const maxStage = Math.max(0, intervals.length - 1)
    const stage = Math.min(Math.max(0, it.stage), maxStage)
    const days = intervals[stage] ?? intervals[maxStage] ?? 1
    const nextDue = addDaysISO(date, days)
    return {
      ...it,
      undo: { stage: it.stage, nextDue: it.nextDue, lastDone: it.lastDone },
      lastDone: date,
      nextDue,
      stage: Math.min(stage + 1, maxStage),
    }
  })
  return { ...data, items }
}

export function undoComplete(data: AppData, itemId: string): AppData {
  const items = data.items.map(it => {
    if (it.id !== itemId) return it
    if (!it.undo) return it
    return {
      ...it,
      stage: it.undo.stage,
      nextDue: it.undo.nextDue,
      lastDone: it.undo.lastDone,
      undo: undefined,
    }
  })
  return { ...data, items }
}

export function resetItem(data: AppData, itemId: string, date: ISODate = todayJST()): AppData {
  // やり直し：stageを0に戻し、次回を今日にする。lastDone/undoも消す（見た目で変化が分かる）
  const items = data.items.map(it =>
    it.id === itemId ? ({ ...it, stage: 0, nextDue: date, lastDone: null, undo: undefined }) : it
  )
  return { ...data, items }
}

export function moveDueDate(data: AppData, itemId: string, newDue: ISODate): AppData {
  // 「明日に回す」「日付を指定」等：stageは変えず nextDue だけ動かす
  const items = data.items.map(it =>
    it.id === itemId ? ({ ...it, nextDue: newDue }) : it
  )
  return { ...data, items }
}

export function updateItem(data: AppData, itemId: string, patch: Partial<Item>): AppData {
  const items = data.items.map(it => it.id === itemId ? ({ ...it, ...patch }) : it)
  return { ...data, items }
}
