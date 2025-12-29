export function parseIntervals(input: string): number[] {
  // Accept "1,2,4,7" or "1 2 4 7"
  // Empty (or "なし") => []  (復習なし)
  const trimmed = (input ?? '').trim()
  if (trimmed === '' || trimmed === 'なし' || trimmed.toLowerCase() === 'none') return []

  const nums = trimmed
    .split(/[,\s]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => Number(s))
    .filter(n => Number.isFinite(n))

  const ints = nums.map(n => Math.floor(n)).filter(n => n >= 1)
  const uniq = Array.from(new Set(ints)).sort((a, b) => a - b)
  if (uniq.length === 0) throw new Error('復習間隔は1以上の整数を入力してください（復習なしなら空欄/なし）。')
  return uniq
}
