import type { AppData, IntervalSet, Item } from './types'
import { todayJST } from './date'
import { uid } from './id'

const KEY = 'review_todo_app_v1'

const DEFAULT_INTERVALS = [1, 2, 4, 7, 14, 30, 60]

function seed(): AppData {
  const t = todayJST()
  const defaultSet: IntervalSet = {
    id: uid('set'),
    name: '短め回転',
    intervalsDays: DEFAULT_INTERVALS,
    isDefault: true,
    createdAt: t,
  }

function normalize(data: AppData): AppData {
  const defaultSet = getDefaultSet(data.intervalSets)
  const items = (data.items ?? []).map(it => ({
    ...it,
    intervalSetId: it.intervalSetId ?? defaultSet.id,
    undo: (it as any).undo ?? undefined,
  }))
  return { ...data, items }
}

  const memSet: IntervalSet = {
    id: uid('set'),
    name: '暗記超短',
    intervalsDays: [1, 1, 2, 4, 7, 14, 30].filter((v, i, a) => a.indexOf(v) === i).sort((a,b)=>a-b),
    isDefault: false,
    createdAt: t,
  }
  const longSet: IntervalSet = {
    id: uid('set'),
    name: '理解長め',
    intervalsDays: [2, 4, 7, 14, 30, 60, 120],
    isDefault: false,
    createdAt: t,
  }
  return { intervalSets: [defaultSet, memSet, longSet], items: [] }
}

export function loadData(): AppData {
  const raw = localStorage.getItem(KEY)
  if (!raw) {
    const s = seed()
    localStorage.setItem(KEY, JSON.stringify(s))
    return normalize(s)
  }
  try {
    const parsed = JSON.parse(raw) as AppData
    if (!parsed.intervalSets?.length) return seed()
    // Ensure exactly one default
    const hasDefault = parsed.intervalSets.some(s => s.isDefault)
    if (!hasDefault) parsed.intervalSets[0].isDefault = true
    if (parsed.intervalSets.filter(s => s.isDefault).length > 1) {
      let first = true
      parsed.intervalSets = parsed.intervalSets.map(s => ({ ...s, isDefault: first ? (first=false, true) : false }))
    }
    return normalize(parsed)
  } catch {
    const s = seed()
    localStorage.setItem(KEY, JSON.stringify(s))
    return s
  }
}

export function saveData(data: AppData) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function getDefaultSet(sets: IntervalSet[]): IntervalSet {
  return sets.find(s => s.isDefault) ?? sets[0]
}

export function getSetById(sets: IntervalSet[], id: string | null): IntervalSet {
  if (!id) return getDefaultSet(sets)
  return sets.find(s => s.id === id) ?? getDefaultSet(sets)
}

export function createItem(
  params: { title: string; tags: string[]; intervalSetId: string | null; startDue?: string },
  sets: IntervalSet[],
): Item {
  const t = todayJST()
  const due = params.startDue ?? t
  return {
    id: uid('it'),
    title: params.title,
    tags: params.tags,
    stage: 0,
    nextDue: due,
    lastDone: null,
    createdAt: t,
    intervalSetId: params.intervalSetId ?? getDefaultSet(sets).id,
  }
}
