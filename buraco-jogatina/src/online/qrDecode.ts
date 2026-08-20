/**
 * Decodificação de QR a partir de um <video> ao vivo, com DOIS caminhos:
 *
 *  1. BarcodeDetector (nativo do WebView/Chrome) — rápido e sem custo de
 *     bundle, mas no ANDROID depende do Google Play Services: em aparelho
 *     sem GMS (ou com GMS < 19.7.42) o construtor existe mas
 *     `getSupportedFormats()` volta VAZIO e ele nunca decodifica nada.
 *     Por isso a checagem aqui é pelos FORMATOS, nunca por
 *     `'BarcodeDetector' in window`.
 *  2. jsQR (JS puro) — funciona em qualquer lugar, inclusive sem GMS e em
 *     navegadores que nem têm a API (Firefox, Safari sem flag). É o que
 *     torna o risco do item 1 irrelevante.
 */

interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike
  getSupportedFormats?: () => Promise<string[]>
}

function getCtor(): BarcodeDetectorCtor | null {
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  return typeof ctor === 'function' ? ctor : null
}

/** Só a câmera é requisito de verdade: o decodificador sempre existe, nem
 * que seja o jsQR. */
export function canScanQr(): boolean {
  return Boolean(navigator.mediaDevices?.getUserMedia)
}

/** Lê um frame do vídeo e devolve o texto do QR, ou null. */
export type QrDecoder = (video: HTMLVideoElement) => Promise<string | null>

/** Qual motor a sessão acabou usando (aparece só em log/diagnóstico). */
export type QrEngine = 'BarcodeDetector' | 'jsQR'

export interface QrDecoderSetup {
  decode: QrDecoder
  engine: QrEngine
}

/**
 * Escolhe o motor uma vez, no início da leitura. Prefere o nativo quando ele
 * REALMENTE suporta 'qr_code'; senão cai pro jsQR.
 */
export async function createQrDecoder(): Promise<QrDecoderSetup> {
  const Ctor = getCtor()
  if (Ctor) {
    try {
      const formats = (await Ctor.getSupportedFormats?.()) ?? []
      if (formats.includes('qr_code')) {
        const detector = new Ctor({ formats: ['qr_code'] })
        return {
          engine: 'BarcodeDetector',
          decode: async video => {
            const codes = await detector.detect(video)
            return codes.length > 0 ? codes[0].rawValue : null
          },
        }
      }
    } catch {
      // Play Services ausente/velho, ou API atrás de flag: usa o jsQR.
    }
  }

  // import() dinâmico: o jsQR vira um CHUNK SEPARADO, baixado só quando o
  // caminho nativo não serve. Importado no topo, ele engordava o bundle
  // principal em ~135 KB que todo mundo pagaria (inclusive quem só joga
  // offline) por um fallback que a maioria dos aparelhos nunca usa.
  const { default: jsQR } = await import('jsqr')

  // Canvas reaproveitado entre frames (criar um por frame torraria memória
  // a 60fps).
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  return {
    engine: 'jsQR',
    decode: async video => {
      if (!ctx) return null
      const w = video.videoWidth
      const h = video.videoHeight
      if (!w || !h) return null
      canvas.width = w
      canvas.height = h
      ctx.drawImage(video, 0, 0, w, h)
      const { data } = ctx.getImageData(0, 0, w, h)
      const result = jsQR(data, w, h, { inversionAttempts: 'dontInvert' })
      return result?.data ?? null
    },
  }
}
