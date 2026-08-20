import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@fontsource/righteous/400.css'
import './styles/index.css'
import { useGameStore } from './store/gameStore'

// DEV-only: expõe o store pra depuração manual no console (reproduzir bugs de
// baixar sequência etc.). Removido do bundle de produção pelo tree-shaking do
// `import.meta.env.DEV`.
if (import.meta.env.DEV) {
  ;(window as unknown as { __store: typeof useGameStore }).__store = useGameStore
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// NÃO registramos mais service worker (ele causava tela verde no APK, servindo
// um shell velho do cache). Ao contrário: LIMPAMOS qualquer SW/cache que tenha
// ficado registrado por versões anteriores — assim o app volta a carregar os
// assets embutidos direto, sem intermediário. Roda em todo contexto (APK e
// navegador), de forma silenciosa.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister().catch(() => {}))
  }).catch(() => {})
}
if (typeof caches !== 'undefined' && caches.keys) {
  caches.keys().then((keys) => keys.forEach((k) => caches.delete(k).catch(() => {}))).catch(() => {})
}
