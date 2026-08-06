import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import QRCode from 'qrcode'
import { useOnlineStore, joinUrlFor } from '../../online/onlineStore'
import DifficultySelector from '../Menu/DifficultySelector'
import type { AIDifficulty } from '../../engine/ai'

/** Room code from a `?sala=CODE` invite link, read once on first render.
 * Used to pre-fill the join view so scanning the QR from OnlineLobby just
 * needs a name + tap. Returns null (and leaves the URL untouched) when the
 * param isn't present. */
function readInviteCodeFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('sala')
  if (!code) return null
  // Clean the param so a refresh/back doesn't re-trigger the prefill.
  params.delete('sala')
  const query = params.toString()
  window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''))
  return code.toUpperCase()
}

interface OnlineLobbyProps {
  onBackToMenu: () => void
  /** Fires once the match actually starts (first `state` view arrives). */
  onGameStart: () => void
}

const SEAT_LABELS = ['Assento 1 (Você/Host)', 'Assento 2', 'Assento 3 (Parceiro)', 'Assento 4']

export default function OnlineLobby({ onBackToMenu, onGameStart }: OnlineLobbyProps) {
  const connection = useOnlineStore((s) => s.connection)
  const code = useOnlineStore((s) => s.code)
  const seat = useOnlineStore((s) => s.seat)
  const isHost = useOnlineStore((s) => s.isHost)
  const lobby = useOnlineStore((s) => s.lobby)
  const view = useOnlineStore((s) => s.view)
  const errorMsg = useOnlineStore((s) => s.errorMsg)
  const serverUrl = useOnlineStore((s) => s.serverUrl)
  const createRoom = useOnlineStore((s) => s.create)
  const joinRoom = useOnlineStore((s) => s.join)
  const startRoom = useOnlineStore((s) => s.start)
  const clearError = useOnlineStore((s) => s.clearError)

  const [inviteCode] = useState(readInviteCodeFromUrl)
  const [name, setName] = useState('Você')
  const [joinCode, setJoinCode] = useState(inviteCode ?? '')
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>(inviteCode ? 'join' : 'choose')
  const [showDifficulty, setShowDifficulty] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (view) onGameStart()
  }, [view, onGameStart])

  useEffect(() => {
    if (!code) {
      setQrDataUrl(null)
      return
    }
    const url = joinUrlFor(code, serverUrl)
    let cancelled = false
    QRCode.toDataURL(url, { width: 220, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [code, serverUrl])

  const handleCreate = (difficulty: AIDifficulty) => {
    setShowDifficulty(false)
    createRoom(name.trim() || 'Você', difficulty)
  }

  const handleJoin = () => {
    const trimmed = joinCode.trim().toUpperCase()
    if (!trimmed) return
    joinRoom(trimmed, name.trim() || 'Você')
  }

  const inRoom = code !== null

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <h1 className="font-display text-3xl text-card-gold drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] sm:text-4xl">
        Jogar Online
      </h1>

      {errorMsg && (
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm rounded-xl bg-red-500/15 px-4 py-2 text-sm text-red-200"
        >
          {errorMsg}
          <button type="button" onClick={clearError} className="ml-2 underline">
            ok
          </button>
        </motion.p>
      )}

      {!inRoom && (
        <div className="w-full max-w-sm space-y-4">
          <div>
            <label htmlFor="online-name" className="sr-only">
              Seu nome
            </label>
            <input
              id="online-name"
              type="text"
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center text-white placeholder-gray-400 shadow-inner outline-none backdrop-blur-sm transition focus:ring-4 focus:ring-card-gold/70"
            />
          </div>

          {mode === 'choose' && (
            <div className="flex flex-col gap-3">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowDifficulty(true)}
                className="min-h-[44px] w-full rounded-xl bg-gradient-to-b from-card-gold-light to-card-gold px-6 py-3 font-bold text-black shadow-lg shadow-black/30 transition-colors hover:from-card-gold hover:to-card-gold-dark"
              >
                Criar Sala
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setMode('join')}
                className="min-h-[44px] w-full rounded-xl border-2 border-card-gold/70 bg-black/20 px-6 py-3 font-bold text-card-gold backdrop-blur-sm transition-colors hover:bg-card-gold/10"
              >
                Entrar em uma Sala
              </motion.button>
            </div>
          )}

          {mode === 'join' && (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Código da sala"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={5}
                className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center font-display text-2xl tracking-[0.3em] text-card-gold placeholder-gray-500 shadow-inner outline-none backdrop-blur-sm transition focus:ring-4 focus:ring-card-gold/70"
              />
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleJoin}
                disabled={connection === 'connecting'}
                className="min-h-[44px] w-full rounded-xl bg-gradient-to-b from-card-gold-light to-card-gold px-6 py-3 font-bold text-black shadow-lg shadow-black/30 transition-colors hover:from-card-gold hover:to-card-gold-dark disabled:opacity-50"
              >
                {connection === 'connecting' ? 'Conectando…' : 'Entrar'}
              </motion.button>
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="text-sm text-gray-300 underline decoration-dotted underline-offset-4 hover:text-card-gold"
              >
                Voltar
              </button>
            </div>
          )}
        </div>
      )}

      {inRoom && (
        <div className="w-full max-w-sm space-y-6">
          <div className="rounded-2xl border border-card-gold/40 bg-black/25 p-6 shadow-lg backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wide text-gray-300">Código da sala</p>
            <p className="font-display text-5xl tracking-[0.3em] text-card-gold drop-shadow-[0_2px_10px_rgba(212,175,55,0.5)]">
              {code}
            </p>
            <p className="mt-2 text-xs text-gray-400">Compartilhe este código para outros entrarem</p>
          </div>

          {qrDataUrl && (
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-2xl bg-white p-3 shadow-lg">
                <img src={qrDataUrl} alt="QR code para entrar na sala" width={200} height={200} className="block" />
              </div>
              <p className="text-xs text-gray-400">Aponte a câmera do outro celular para entrar</p>
            </div>
          )}

          <div className="space-y-2 text-left">
            {SEAT_LABELS.map((label, i) => {
              const seatInfo = lobby.find((s) => s.index === i)
              const isYou = seat === i
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${
                    isYou ? 'border-card-gold bg-card-gold/10' : 'border-white/10 bg-white/5'
                  }`}
                >
                  <span className="text-sm text-gray-200">
                    {seatInfo?.name ?? label}
                    {isYou ? ' (você)' : ''}
                  </span>
                  <span className="text-xs text-gray-400">
                    {seatInfo?.kind === 'human'
                      ? seatInfo.connected
                        ? '🧑 humano'
                        : '🧑 humano (offline)'
                      : '🤖 IA'}
                  </span>
                </div>
              )
            })}
          </div>

          {isHost ? (
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={startRoom}
              className="min-h-[44px] w-full rounded-xl bg-gradient-to-b from-card-gold-light to-card-gold px-6 py-3 font-bold text-black shadow-lg shadow-black/30 transition-colors hover:from-card-gold hover:to-card-gold-dark"
            >
              Iniciar Partida
            </motion.button>
          ) : (
            <p className="text-sm text-gray-300">Aguardando o host iniciar a partida…</p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onBackToMenu}
        className="text-sm text-gray-300 underline decoration-dotted underline-offset-4 hover:text-card-gold"
      >
        Voltar ao Menu
      </button>

      {showDifficulty && (
        <DifficultySelector onSelect={handleCreate} onCancel={() => setShowDifficulty(false)} />
      )}
    </div>
  )
}
