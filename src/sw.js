import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

clientsClaim()

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('push', event => {
  let data = {}
  try { data = event.data?.json() ?? {} } catch {}

  const title      = data.title ?? 'Covey Space'
  const url        = data.url ?? '/chat'
  const targetPath = new URL(url, self.location.origin).pathname
  const options    = {
    body:      data.body ?? '',
    icon:      '/icons/icon-192.png',
    badge:     '/icons/icon-192.png',
    tag:       url === '/prayer' ? 'prayer-reaction' : 'chat-message',
    renotify:  true,
    data:      { url },
  }

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // If the user already has the target page open and visible, skip the
        // notification popup and badge — the realtime subscription handles it.
        const activeOnTarget = clientList.some(
          c => c.visibilityState === 'visible' && new URL(c.url).pathname === targetPath
        )
        if (activeOnTarget) return

        return Promise.all([
          self.registration.showNotification(title, options),
          navigator.setAppBadge?.().catch?.(() => {}),
        ])
      })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  navigator.clearAppBadge?.().catch?.(() => {})
  const url = event.notification.data?.url ?? '/chat'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.postMessage({ type: 'NAVIGATE', url, notifTitle: event.notification.title, notifBody: event.notification.body })
            return client.focus()
          }
        }
        if (clients.openWindow) return clients.openWindow(url)
      })
  )
})
