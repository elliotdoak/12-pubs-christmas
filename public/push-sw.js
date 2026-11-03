/* Web push handlers, pulled into the generated service worker via workbox importScripts. */

self.addEventListener('push', (event) => {
  let d = {}
  try {
    d = event.data ? event.data.json() : {}
  } catch {
    d = { body: event.data ? event.data.text() : '' }
  }
  // Every push must show a notification, or iPhones withdraw the permission
  event.waitUntil(
    self.registration.showNotification(d.title || '12 PUBS', {
      body: d.body || '',
      tag: d.tag || 'general',
      renotify: true,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      vibrate: d.tag === 'alarm' ? [400, 200, 400, 200, 400] : [200],
      requireInteraction: d.tag === 'alarm',
      data: { url: d.url || '/' },
    }),
  )
})

// Tapping a notification brings the app forward (or opens it) on the right screen
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      const open = list.find((c) => c.url.startsWith(self.location.origin))
      if (!open) return self.clients.openWindow(url)
      await open.focus()
      if (open.url !== url && 'navigate' in open) await open.navigate(url).catch(() => {})
    }),
  )
})
