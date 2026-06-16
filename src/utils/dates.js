// Returns the next Tuesday after today (7 days ahead if today is already Tuesday).
export function getNextTuesday(from = new Date()) {
  const d = new Date(from)
  const day = d.getDay() // 0=Sun, 2=Tue
  const diff = day === 2 ? 7 : day < 2 ? 2 - day : 9 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Converts a Date to a YYYY-MM-DD string in local time.
export function toDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Formats a YYYY-MM-DD string as "Tuesday, June 17, 2026" using local time.
export function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// Replaces an old formatted date embedded in a title with the new one, if present.
export function patchTitleDate(title, oldDateStr, newDateStr) {
  const oldFormatted = formatDate(oldDateStr)
  if (!title.includes(oldFormatted)) return title
  return title.replace(oldFormatted, formatDate(newDateStr))
}
