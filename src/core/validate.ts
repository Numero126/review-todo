export function parseIntervals(input: string): number[] {
  // Accept "1,2,4,7" or "1 2 4 7"
  const nums = input
    .split(/[,\s]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => Number(s))
    .filter(n => Number.isFinite(n))

  const ints = nums.map(n => Math.floor(n)).filter(n => n >= 1)
  // unique + sort
  const uniq = Array.from(new Set(ints)).sort((a, b) => a - b)
  if (uniq.length === 0) throw new Error('復習間隔は1以上の整数を1つ以上入力してください。')
  return uniq
}
