import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { createQrDecoder, type QrDecoder } from '../../online/qrDecode'

export { canScanQr } from '../../online/qrDecode'

type ScanState = 'starting' | 'scanning' | 'error'

interface QrScannerProps {
  onScan: (raw: string) => boolean
  onClose: () => void
}

export default function QrScanner({ onScan, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [state, setState] = useState<ScanState>('starting')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const stoppedRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('error')
      setErrorMsg('Este aparelho não permite ler QR pelo app. Digite o código da sala à mão.')
      return
    }

    let rafId = 0

    const tick = async (decode: QrDecoder) => {
      if (stoppedRef.current) return
      const video = videoRef.current
      if (video && video.readyState >= 2 ) {
        try {
          const raw = await decode(video)
          if (raw && onScanRef.current(raw)) {
            stoppedRef.current = true
            return
          }
        } catch {
          // Falha pontual de decodificação num frame é normal (foco, luz):
          // segue pro próximo frame em vez de derrubar o scanner.
        }
      }
      rafId = requestAnimationFrame(() => void tick(decode))
    }

    Promise.all([
      createQrDecoder(),
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } }),
    ])
      .then(([{ decode }, stream]) => {
        if (stoppedRef.current) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play()
        }
        setState('scanning')
        void tick(decode)
      })
      .catch((err: unknown) => {
        setState('error')
        const name = err instanceof Error ? err.name : ''
        setErrorMsg(
          name === 'NotAllowedError'
            ? 'Permissão de câmera negada. Libere a câmera para o app e tente de novo.'
            : 'Não foi possível abrir a câmera. Digite o código da sala à mão.'
        )
      })

    return () => {
      stoppedRef.current = true
      cancelAnimationFrame(rafId)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140] flex flex-col items-center justify-center bg-black/90 p-4"
    >
      <h2 className="mb-2 font-display text-xl text-card-gold landscape:mb-1 landscape:text-base">
        Escaneie o QR da sala
      </h2>

      {state === 'error' ? (
        <p className="max-w-sm text-center text-sm text-red-200">{errorMsg}</p>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border-2 border-card-gold/70 shadow-[0_0_30px_rgba(212,175,55,0.35)]">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-[46vh] w-auto max-w-[80vw] bg-black object-cover landscape:h-[52vh]"
          />
          {state === 'starting' && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-200">
              Abrindo a câmera…
            </p>
          )}
        </div>
      )}

      <p className="mt-2 max-w-sm text-center text-xs text-gray-400 landscape:mt-1">
        Aponte para o QR que aparece no celular de quem criou a sala.
      </p>

      <button
        type="button"
        onClick={onClose}
        className="mt-3 min-h-[44px] rounded-xl border-2 border-card-gold/70 bg-black/40 px-6 py-2 font-bold text-card-gold landscape:mt-2 landscape:min-h-0 landscape:py-1.5 landscape:text-sm"
      >
        Cancelar
      </button>
    </motion.div>
  )
}
