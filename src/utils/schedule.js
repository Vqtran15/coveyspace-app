export function weekOccToMode(occ) {
  if (!occ || occ.length === 5) return 'weekly'
  if (occ.length === 2 && ((occ[0]===1&&occ[1]===3)||(occ[0]===2&&occ[1]===4))) return 'biweekly'
  return 'custom'
}

// Returns [{n, date}] for every occurrence of `dow` (0=Sun) in the given month
function getWeekdayOccurrencesInMonth(year, month, dow) {
  const results = []
  const d = new Date(year, month, 1)
  while (d.getDay() !== dow) d.setDate(d.getDate() + 1)
  let n = 1
  while (d.getMonth() === month) {
    results.push({ n, date: new Date(d) })
    d.setDate(d.getDate() + 7)
    n++
  }
  return results
}

function nextScheduledDateSingle(fromDate, dow, weekOccurrences) {
  const from = new Date(fromDate)
  from.setHours(0, 0, 0, 0)
  let year  = from.getFullYear()
  let month = from.getMonth()
  for (let i = 0; i < 4; i++) {
    const hits = getWeekdayOccurrencesInMonth(year, month, dow)
      .filter(({ n }) => weekOccurrences.includes(n))
      .map(({ date }) => date)
    for (const d of hits) {
      if (d > from) return d
    }
    month++
    if (month > 11) { month = 0; year++ }
  }
  return null
}

// Returns the next scheduled date strictly after `fromDate` given a day-of-week
// (int or int[]) and an array of which week-of-month occurrences to include.
export function nextScheduledDate(fromDate, dow, weekOccurrences) {
  const dows = Array.isArray(dow) ? dow : [dow]
  const candidates = dows.map(d => nextScheduledDateSingle(fromDate, d, weekOccurrences)).filter(Boolean)
  if (!candidates.length) return null
  return candidates.reduce((a, b) => (a < b ? a : b))
}
