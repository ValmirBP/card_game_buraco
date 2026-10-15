import { Fragment, useEffect, useRef, useState } from 'react'
import VuChip from '../Gameplay/VuChip'
import EmoteLayer from './EmoteLayer'
import { vuBannerText } from '../Gameplay/vulnerability'
import { motion, AnimatePresence } from 'framer-motion'
import { useOnlineStore } from '../../online/onlineStore'
import OnlineGameBoard from './OnlineGameBoard'
import OnlinePlayerHand from './OnlinePlayerHand'
import OnlineDiscardRow from './OnlineDiscardRow'
import OnlineResult from './OnlineResult'
import DrawAnimation from '../Gameplay/DrawAnimation'
import CardFlyAnimation from '../Gameplay/CardFlyAnimation'
import ExitButton from '../ExitButton'
import { otherSeatsInOrder } from '../../online/seatLayout'
import type { TeamId } from '../../engine/gameState'

const TEAM_LABEL: Record<'A' | 'B', string> = { A: 'Nós', B: 'Eles' }

interface OnlineGameplayProps {
  onBackToMenu: () => void
}

export default function OnlineGameplay({ onBackToMenu }: OnlineGameplayProps) {
  const view = useOnlineStore(s => s.view)
  const log = useOnlineStore(s => s.log)
  const connection = useOnlineStore(s => s.connection)
  const errorMsg = useOnlineStore(s => s.errorMsg)
  const clearError = useOnlineStore(s => s.clearError)
  const drawAnim = useOnlineStore(s => s.drawAnim)
  const pickupAnim = useOnlineStore(s => s.pickupAnim)
  const discardAnim = useOnlineStore(s => s.discardAnim)
  const tableAnim = useOnlineStore(s => s.tableAnim)

  const status = view?.status
  const [resultReady, setResultReady] = useState(false)
  useEffect(() => {
    if (status !== 'finished') {
      setResultReady(false)
      return
    }
    const timeoutId = window.setTimeout(() => setResultReady(true), 2000)
    return () => clearTimeout(timeoutId)
  }, [status])

  const [vuBanner, setVuBanner] = useState<string | null>(null)
  const round = view?.round
  useEffect(() => {
    const current = useOnlineStore.getState().view
    if (!current || current.status !== 'playing') return
    const myTeam = current.players[current.seat]?.teamId ?? 'A'
    const text = vuBannerText(
      current.teams.map(t => ({ id: t.id, openingMinimum: t.openingMinimum ?? 0, melds: t.melds })),
      myTeam
    )
    if (!text) return
    setVuBanner(text)
    const id = window.setTimeout(() => setVuBanner(c => (c === text ? null : c)), 3500)
    return () => window.clearTimeout(id)
  }, [round])

  const [mortoBanner, setMortoBanner] = useState<string | null>(null)
  const seenLogLenRef = useRef(log.length)
  const bannerTimeoutRef = useRef<number | null>(null)
  useEffect(() => {
    const newEntries = log.slice(seenLogLenRef.current)
    seenLogLenRef.current = log.length
    const mortoEntry = [...newEntries].reverse().find(e => /pegou o morto|virou o novo monte/i.test(e))
    if (!mortoEntry) return
    setMortoBanner(/virou o novo monte/i.test(mortoEntry) ? '🔄 O morto virou o novo monte!' : `🎴 ${mortoEntry}`)
    if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current)
    bannerTimeoutRef.current = window.setTimeout(() => setMortoBanner(null), 2600)
  }, [log])

  if (!view) return null

  if (view.status === 'finished' && resultReady) {
    return <OnlineResult view={view} onBackToMenu={onBackToMenu} />
  }

  const handleExit = () => {
    if (window.confirm('Sair da partida em andamento? Você será desconectado dos outros jogadores.')) {
      onBackToMenu()
    }
  }

  const closerName = view.closerSeat !== undefined ? view.players[view.closerSeat]?.name : undefined
  const batidaBanner =
    view.status === 'finished' ? (closerName ? `🏆 ${closerName} bateu!` : '🏁 Fim da rodada!') : null

  const disconnectedNames = view.players.filter(p => p.kind === 'human' && !p.connected).map(p => p.name)
  const isPaused = view.paused && disconnectedNames.length > 0

  const lastLog = log[log.length - 1]
  const myTeamId: TeamId = view.players[view.seat]?.teamId ?? 'A'
  const sortedTeams = [...view.teams].sort((a, b) => (a.id === myTeamId ? -1 : 1) - (b.id === myTeamId ? -1 : 1))
  const partnerSeat = otherSeatsInOrder(view.seat)[1]
  const partner = view.players[partnerSeat]
  const partnerIsTurn = view.status === 'playing' && view.currentSeat === partnerSeat

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 landscape:gap-0.5">
      <AnimatePresence>
        {batidaBanner && (
          <motion.div
            key={batidaBanner}
            initial={{ opacity: 0, scale: 0.6, y: -14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 280, damping: 18 }}
            className="pointer-events-none fixed inset-x-0 top-1/3 z-[130] flex justify-center px-4"
          >
            <span className="rounded-2xl border-2 border-card-gold bg-black/85 px-8 py-4 text-center font-display text-2xl text-card-gold shadow-[0_0_40px_rgba(212,175,55,0.8)] backdrop-blur-sm sm:text-3xl">
              {batidaBanner}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <EmoteLayer mySeat={view.seat} />
      <DrawAnimation anim={drawAnim} />
      <CardFlyAnimation anim={pickupAnim} />
      <CardFlyAnimation anim={discardAnim} />
      <CardFlyAnimation anim={tableAnim} />

      <AnimatePresence>
        {vuBanner && (
          <motion.div
            key={vuBanner}
            initial={{ opacity: 0, scale: 0.7, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="pointer-events-none fixed inset-x-0 top-1/4 z-[115] flex justify-center px-4"
            data-vu-banner
          >
            <span className="rounded-2xl border-2 border-red-500 bg-black/85 px-5 py-2.5 text-center font-display text-base text-red-200 shadow-[0_0_30px_rgba(220,38,38,0.6)] backdrop-blur-sm sm:text-xl">
              {vuBanner}
            </span>
          </motion.div>
        )}
        {mortoBanner && (
          <motion.div
            key={mortoBanner}
            initial={{ opacity: 0, scale: 0.7, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="pointer-events-none fixed inset-x-0 top-1/3 z-[120] flex justify-center px-4"
          >
            <span className="rounded-2xl border-2 border-card-gold bg-black/80 px-6 py-3 text-center font-display text-lg text-card-gold shadow-[0_0_30px_rgba(212,175,55,0.7)] backdrop-blur-sm sm:text-2xl">
              {mortoBanner}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex shrink-0 items-start gap-2 landscape:gap-1.5">
        <ExitButton onClick={handleExit} />
        <div className="z-40 min-w-0 flex-1 rounded-xl border border-card-gold/30 bg-black/40 px-2 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-md landscape:rounded-md landscape:px-1.5 landscape:py-0">
        <div className="mx-auto flex max-w-7xl flex-nowrap items-center justify-center gap-2 landscape:gap-1.5">
          {sortedTeams.map((team, i) => {
            const isMine = team.id === myTeamId
            const matchTotal = view.matchScores[team.id] + (view.status === 'finished' ? 0 : team.score)
            const canastraCount = team.melds.filter(m => m.isCanastra).length
            return (
              <Fragment key={team.id}>
                <div
                  className={`flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-0.5 ${
                    isMine ? 'border border-card-gold/50 bg-card-gold/10' : 'border border-fuchsia-400/40 bg-fuchsia-500/10'
                  }`}
                >
                  <span className={`font-display text-xs ${isMine ? 'text-card-gold' : 'text-fuchsia-300'}`}>
                    {TEAM_LABEL[isMine ? 'A' : 'B']}
                  </span>
                  <VuChip minimum={team.openingMinimum ?? 0} opened={team.melds.length > 0} />
                  <span className="text-base font-bold text-white" title="Pontos da partida atual">
                    {matchTotal}
                  </span>
                  <span className="whitespace-nowrap text-[10px] text-gray-300" title="Canastras (jogos de 7+ cartas)">
                    {canastraCount} can.
                  </span>
                  <span
                    className={`text-[10px] ${team.hasTakenMorto ? 'text-green-300' : 'text-gray-500'}`}
                    title="Morto pego?"
                  >
                    {team.hasTakenMorto ? '✓morto' : '✗morto'}
                  </span>
                </div>
                {i === 0 && partner && (
                  <div
                    data-seat-index={partnerSeat}
                    className={`hidden shrink-0 items-center gap-1 rounded-lg border px-1.5 py-0.5 landscape:flex ${
                      partnerIsTurn ? 'border-card-gold bg-card-gold/15' : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-card-gold/80 text-[8px] font-bold text-black">
                      {partner.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="max-w-[5rem] truncate text-[10px] text-white">{partner.name}</span>
                    <span className="text-[9px] text-gray-400">{partner.handCount}</span>
                  </div>
                )}
              </Fragment>
            )
          })}
        </div>
        </div>
      </div>

      {connection !== 'open' && (
        <p className="shrink-0 rounded-xl bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-200 landscape:py-1 landscape:text-xs">
          {connection === 'connecting'
            ? '🔄 Reconectando…'
            : '⚠️ Você perdeu a conexão. Toque em "Sair" e depois em "Reconectar à sala" no menu.'}
        </p>
      )}

      {errorMsg && (
        <p className="shrink-0 rounded-xl bg-red-500/15 px-4 py-2 text-center text-sm text-red-200 landscape:py-1 landscape:text-xs">
          {errorMsg}
          <button type="button" onClick={clearError} className="ml-2 underline">
            ok
          </button>
        </p>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col gap-2 landscape:gap-0.5">
        <div className="min-h-0 flex-1 overflow-y-auto landscape:overflow-hidden">
          <OnlineGameBoard view={view} />
        </div>

        <div className="shrink-0 truncate rounded-lg border border-white/10 bg-black/25 px-3 py-1.5 text-center text-xs text-gray-300 landscape:hidden">
          <span className="text-card-gold">Registro:</span> {lastLog ?? 'Nenhuma ação ainda.'}
        </div>

        <div className="flex shrink-0 items-stretch gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-1.5 shadow-lg backdrop-blur-sm landscape:gap-1.5 landscape:px-2 landscape:py-0.5">
          <div className="min-w-0 flex-[3]">
            <OnlinePlayerHand view={view} />
          </div>
          <div className="w-px shrink-0 self-stretch bg-white/15" />
          <div className="min-w-0 flex-[2]">
            <OnlineDiscardRow view={view} />
          </div>
        </div>

        <AnimatePresence>
          {isPaused && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[110] flex flex-col items-center justify-center gap-2 rounded-xl bg-black/75 px-6 text-center backdrop-blur-sm"
            >
              <span className="text-3xl">⏸️</span>
              <p className="font-display text-lg text-card-gold sm:text-xl landscape:text-sm">Partida pausada</p>
              <p className="max-w-xs text-sm text-gray-200 landscape:text-xs">
                Aguardando {disconnectedNames.join(' e ')} voltar…
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
