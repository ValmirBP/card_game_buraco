import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.buraco.jogatina',
  appName: 'Buraco Jogatina v9',
  // Vite builds the web app into dist/ — Capacitor bundles it into the APK,
  // so the game runs fully offline (single-player) inside a native WebView.
  webDir: 'dist',
  backgroundColor: '#0f5132',
}

export default config
