import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@fontsource/righteous/400.css'
import './styles/index.css'
import { useGameStore } from './store/gameStore'

if (import.meta.env.DEV) {
  ;(window as unknown as { __store: typeof useGameStore }).__store = useGameStore
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister().catch(() => {}))
  }).catch(() => {})
}
if (typeof caches !== 'undefined' && caches.keys) {
  caches.keys().then((keys) => keys.forEach((k) => caches.delete(k).catch(() => {}))).catch(() => {})
}
