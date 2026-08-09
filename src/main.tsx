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

// Registra o service worker apenas no navegador (PWA) em produção. DENTRO do
// APK (Capacitor) o SW NÃO é registrado: os assets já vêm embutidos no app e o
// SW interceptando o WebView causava tela em branco (só o fundo verde). Em dev
// o SW também não entra (atrapalharia o HMR do Vite).
const isCapacitor = typeof (window as unknown as { Capacitor?: unknown }).Capacitor !== 'undefined'
if (import.meta.env.PROD && !isCapacitor && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
