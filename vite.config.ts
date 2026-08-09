import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Caminhos RELATIVOS dos assets (./assets/...) — funcionam tanto servidos
  // pelo Node (navegador/online) quanto embutidos no APK (Capacitor WebView),
  // onde caminhos absolutos (/assets/...) podiam falhar e dar tela em branco.
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
