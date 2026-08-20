import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.buraco.jogatina',
  appName: 'Buraco Jogatina v25',
  // Vite builds the web app into dist/ — Capacitor bundles it into the APK,
  // so the game runs fully offline (single-player) inside a native WebView.
  webDir: 'dist',
  backgroundColor: '#0f5132',
  server: {
    // Default é 'https' (a página carrega em https://localhost). O modo
    // Online conecta num servidor LAN comum (server/index.ts), que só fala
    // ws:// simples, sem TLS - uma página https:// bloqueia QUALQUER
    // conexão ws:// não criptografada por política de "mixed content" (o
    // WebView lança SecurityError síncrono ao tentar `new WebSocket(...)`,
    // antes mesmo de tentar conectar). 'http' faz a página carregar em
    // http://localhost, onde ws:// é permitido normalmente.
    //
    // NÃO defina `hostname` junto: a página PRECISA continuar em
    // http://localhost. `localhost` é a única origem http que conta como
    // CONTEXTO SEGURO - com qualquer outro hostname o WebView remove
    // `navigator.mediaDevices`, e o leitor de QR da tela Online
    // (src/components/Online/QrScanner.tsx) para de funcionar em silêncio,
    // sem erro visível.
    androidScheme: 'http',
  },
}

export default config
