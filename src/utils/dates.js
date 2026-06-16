// Returns the most recent Wednesday <= today (local time).
// Used internally: the page advances the day after Tuesday (i.e. Wednesday).
function getMostRecentWednesday(from = new Date()) {
  const d = new Date(from)
  const day = d.getDay() // 0=Sun, 3=Wed
  const diff = day >= 3 ? day - 3 : day + 4
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Returns the current "active" potluck Tuesday.
// The page advances on Wednesday (day after the potluck), so the active Tuesday
// is always the one that follows the most recent Wednesday.
export function getCurrentPotluckTuesday(from = new Date()) {
  const wed = getMostRecentWednesday(from)
  wed.setDate(wed.getDate() + 6)
  return wed
}

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
