import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

// Activate the new SW immediately instead of waiting for all tabs to close
self.addEventListener('install', () => self.skipWaiting())
clientsClaim()

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('push', event => {
  let data = {}
  try { data = event.data?.json() ?? {} } catch {}

  const title   = data.title ?? 'Covey Space'
  const url     = data.url ?? '/chat'
  const options = {
    body:      data.body ?? '',
    icon:      '/icons/icon-192.png',
    badge:     '/icons/icon-192.png',
    tag:       url === '/prayer' ? 'prayer-reaction' : 'chat-message',
    renotify:  true,
    data:      { url },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
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
