// KILL-SWITCH service worker.
//
// Versões antigas (v1/v2) registravam um SW cache-first que, dentro do WebView
// do Capacitor (APK), passou a servir um "shell" velho/quebrado — resultando em
// tela verde (WebView em branco). Este SW substitui aquele: ele NÃO intercepta
// nada; ao ativar, apaga todos os caches, se desregistra e recarrega as abas,
// devolvendo o controle ao carregamento normal dos assets embutidos no app.
//
// O navegador/WebView busca o script do SW pela rede ao reabrir, encontra este
// kill-switch, e a limpeza acontece automaticamente.
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
        /* ignore */
      }
      try {
        await self.registration.unregister()
      } catch {
        /* ignore */
      }
      const clients = await self.clients.matchAll({ type: 'window' })
      clients.forEach((client) => {
        try {
          client.navigate(client.url)
        } catch {
          /* ignore */
        }
      })
    })()
  )
})
// Sem handler de 'fetch': o SW não intercepta requisições — os assets carregam
// direto (embutidos no APK ou servidos pelo servidor no navegador).
