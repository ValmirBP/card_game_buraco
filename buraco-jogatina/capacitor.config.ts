import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.buraco.jogatina',
  appName: 'Buraco Jogatina',
  webDir: 'dist',
  backgroundColor: '#0f5132',
  server: {
    androidScheme: 'http',
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    SystemBars: {
      insetsHandling: 'disable',
    },
  },
}

export default config
