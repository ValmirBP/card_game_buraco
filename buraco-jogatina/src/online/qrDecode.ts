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

export function canScanQr(): boolean {
  return Boolean(navigator.mediaDevices?.getUserMedia)
}

export type QrDecoder = (video: HTMLVideoElement) => Promise<string | null>

export type QrEngine = 'BarcodeDetector' | 'jsQR'

export interface QrDecoderSetup {
  decode: QrDecoder
  engine: QrEngine
}

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
    }
  }

  const { default: jsQR } = await import('jsqr')

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
