import type { AppData, IntervalSet, Item, Priority } from './types'
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
  const memSet: IntervalSet = {
    id: uid('set'),
    name: '暗記超短',
    intervalsDays: [1, 1, 2, 4, 7, 14, 30].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b),
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

function normalizePriority(p: any): Priority {
  if (p === 1 || p === 2 || p === 3) return p
  return 2
}

function normalize(data: AppData): AppData {
  const intervalSets = (data.intervalSets ?? []).map(s => ({ ...s }))
  if (intervalSets.length === 0) return seed()

  // Ensure exactly one default
  const hasDefault = intervalSets.some(s => s.isDefault)
  if (!hasDefault) intervalSets[0].isDefault = true
  if (intervalSets.filter(s => s.isDefault).length > 1) {
    let first = true
    for (const s of intervalSets) {
      if (first) {
        s.isDefault = true
        first = false
      } else {
        s.isDefault = false
      }
    }
  }

  const defaultSet = intervalSets.find(s => s.isDefault) ?? intervalSets[0]

  const items = (data.items ?? []).map((it: any) => ({
    ...it,
    intervalSetId: it.intervalSetId ?? defaultSet.id,
    undo: it.undo ?? undefined,

    // v4 fields (migration defaults)
    priority: normalizePriority(it.priority),
    targetMinutes: typeof it.targetMinutes === 'number' ? it.targetMinutes : null,
    notes: typeof it.notes === 'string' ? it.notes : '',
  })) as Item[]

  return { intervalSets, items }
}

export function loadData(): AppData {
  const raw = localStorage.getItem(KEY)
  if (!raw) {
    const s = normalize(seed())
    localStorage.setItem(KEY, JSON.stringify(s))
    return s
  }
  try {
    const parsed = JSON.parse(raw) as AppData
    return normalize(parsed)
  } catch {
    const s = normalize(seed())
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

export function getSetById(sets: IntervalSet[], id: string | null | undefined): IntervalSet {
  const defaultSet = getDefaultSet(sets)
  if (!id) return defaultSet
  return sets.find(s => s.id === id) ?? defaultSet
}

export function createItem(
  params: {
    title: string
    tags: string[]
    intervalSetId: string | null
    startDue?: string
    priority?: Priority
    targetMinutes?: number | null
    notes?: string
  },
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

    priority: params.priority ?? 2,
    targetMinutes: typeof params.targetMinutes === 'number' ? params.targetMinutes : null,
    notes: params.notes ?? '',
  }
}
