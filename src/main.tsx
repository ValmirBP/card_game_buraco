import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@fontsource/righteous/400.css'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Registra o service worker apenas em build de produção — em dev o SW
// atrapalharia HMR/cache do Vite.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
}
