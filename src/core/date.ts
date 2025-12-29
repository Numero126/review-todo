import type { ISODate } from './types'

export function todayJST(): ISODate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function addDaysISO(date: ISODate, days: number): ISODate {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, (m - 1), d))
  dt.setUTCDate(dt.getUTCDate() + days)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(dt)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function tomorrowJST(): ISODate {
  return addDaysISO(todayJST(), 1)
}

export function cmpISO(a: ISODate, b: ISODate): number {
  return a === b ? 0 : (a < b ? -1 : 1)
}
