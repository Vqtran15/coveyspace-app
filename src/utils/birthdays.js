function nextOccurrence(dateStr, today) {
  const [, m, d] = dateStr.split('-').map(Number)
  let next = new Date(today.getFullYear(), m - 1, d)
  if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d)
  return next
}

export function daysUntilNext(dateStr, today = new Date()) {
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((nextOccurrence(dateStr, todayStart) - todayStart) / 86400000)
}

export function getUpcomingBirthdays(birthdays, today = new Date()) {
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return birthdays
    .map(b => ({ ...b, daysUntil: daysUntilNext(b.birthday, todayStart) }))
    .filter(b => b.daysUntil <= 14)
    .sort((a, b) => a.daysUntil - b.daysUntil)
}

export function formatBirthdayDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}
