export function initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

// Shared chat constants — imported by ChatView, MessageList, ConversationList
export const GROUP_TIME_GAP = 5 * 60 * 1000   // ms between messages before showing a new time header
export const VIDEO_URL_RE   = /\.(mp4|mov|webm|m4v|avi|mkv)(\?.*)?$/i
export function isVideoUrl(url) { return url ? VIDEO_URL_RE.test(url) : false }

// Used in chat message timestamps — shows date + time for older messages
export function formatMessageTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// Used in conversation list previews — shows date only for older messages
export function formatListTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
