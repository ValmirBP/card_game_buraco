// Service worker do Buraco Jogatina — cache-first, vanilla (sem workbox/CDN).
//
// Bump esta versão sempre que o app shell mudar de forma significativa;
// o activate limpa qualquer cache de versão anterior automaticamente.
const CACHE_VERSION = 'buraco-jogatina-v1'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest']

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Cache-first: assets do build (hashed em /assets/*) e o app shell.
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached

      return fetch(request)
        .then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response
          }
          const responseToCache = response.clone()
          const isRuntimeCacheable =
            url.pathname.startsWith('/assets/') || APP_SHELL.includes(url.pathname)
          if (isRuntimeCacheable) {
            caches.open(CACHE_VERSION).then(cache => cache.put(request, responseToCache))
          }
          return response
        })
        .catch(() => {
          // Offline e sem cache: para navegações, cai de volta ao shell.
          if (request.mode === 'navigate') {
            return caches.match('/index.html')
          }
          return undefined
        })
    })
  )
})
