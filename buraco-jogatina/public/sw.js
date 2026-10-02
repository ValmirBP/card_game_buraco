self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      } catch {

      }
      try {
        await self.registration.unregister()
      } catch {

      }
      const clients = await self.clients.matchAll({ type: 'window' })
      clients.forEach((client) => {
        try {
          client.navigate(client.url)
        } catch {

        }
      })
    })()
  )
})

