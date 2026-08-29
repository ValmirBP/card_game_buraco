import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOnlineStore } from '../../online/onlineStore'
import OnlineGameBoard from './OnlineGameBoard'
import OnlinePlayerHand from './OnlinePlayerHand'
import OnlineDiscardRow from './OnlineDiscardRow'
import OnlineResult from './OnlineResult'
import DrawAnimation from '../Gameplay/DrawAnimation'
import CardFlyAnimation from '../Gameplay/CardFlyAnimation'
import ExitButton from '../ExitButton'
import type { TeamId } from '../../engine/gameState'

const TEAM_LABEL: Record<'A' | 'B', string> = { A: 'Nós', B: 'Eles' }

interface OnlineGameplayProps {
  onBackToMenu: () => void
}

/** Online equivalent of Gameplay.tsx: no local turn/AI-scheduling logic at
 * all (the server is authoritative and pushes a fresh `state` after every
 * change, including AI turns) — só renderiza a SeatView atual. Manipulação
 * direta (clicar no monte/descarte/mesa) substitui o antigo painel de
 * botões (OnlineActionPanel, removido), igual ao modo offline. */
export default function OnlineGameplay({ onBackToMenu }: OnlineGameplayProps) {
  const view = useOnlineStore(s => s.view)
  const log = useOnlineStore(s => s.log)
  const errorMsg = useOnlineStore(s => s.errorMsg)
  const clearError = useOnlineStore(s => s.clearError)
  const drawAnim = useOnlineStore(s => s.drawAnim)
  const pickupAnim = useOnlineStore(s => s.pickupAnim)
  const discardAnim = useOnlineStore(s => s.discardAnim)
  const tableAnim = useOnlineStore(s => s.tableAnim)

  // Rodada terminou: segura 2s mostrando o banner "Fulano bateu!" sobre a
  // mesa antes de trocar pro placar (igual ao Gameplay offline). Volta a
  // false quando o host inicia a próxima rodada (status -> 'playing').
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

  // Banner do MORTO (pega / vira monte) — mesma técnica do Gameplay offline:
  // varre as linhas NOVAS do log a cada mudança e mostra um banner quando
  // alguma anuncia o evento. Começa apontando pro fim do log ATUAL (não 0),
  // senão reabriria a sala/reconectaria e mostraria de novo avisos antigos.
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

  // Sair da partida em andamento (com confirmação — mesmo texto/mesma ação
  // do voltar de hardware do Android pra este mesmo estado, ver App.tsx).
  const handleExit = () => {
    if (window.confirm('Sair da partida em andamento? Você será desconectado dos outros jogadores.')) {
      onBackToMenu()
    }
  }

  const closerName = view.closerSeat !== undefined ? view.players[view.closerSeat]?.name : undefined
  const batidaBanner =
    view.status === 'finished' ? (closerName ? `🏆 ${closerName} bateu!` : '🏁 Fim da rodada!') : null

  const lastLog = log[log.length - 1]
  // "Nós"/"Eles" relativo ao próprio time, igual ao GameBoard online.
  const myTeamId: TeamId = view.players[view.seat]?.teamId ?? 'A'
  const sortedTeams = [...view.teams].sort((a, b) => (a.id === myTeamId ? -1 : 1) - (b.id === myTeamId ? -1 : 1))

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 landscape:gap-0.5">
      {/* Banner de BATIDA: 2s antes do placar (ver Gameplay offline) */}
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

      {/* Fantasmas de animação — mesmos componentes do offline
          (DrawAnimation/CardFlyAnimation), disparados por OnlineGameBoard.tsx
          e OnlineDiscardRow.tsx e lidos aqui via onlineStore. Sem o
          equivalente de AiDrawAnimation: o servidor roda os turnos remotos
          no seu próprio ritmo, sem um evento local pra ancorar esse
          fantasma (ver comentário em onlineStore.ts). */}
      <DrawAnimation anim={drawAnim} />
      <CardFlyAnimation anim={pickupAnim} />
      <CardFlyAnimation anim={discardAnim} />
      <CardFlyAnimation anim={tableAnim} />

      {/* Banner de destaque do morto (pega / virou monte) — ver Gameplay offline */}
      <AnimatePresence>
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

      {/* Placar + saída — mesmo tratamento do modo offline (ver
          Gameplay.tsx), pedido do usuário. */}
      <div className="flex shrink-0 items-start gap-2 landscape:gap-1.5">
        <ExitButton onClick={handleExit} />
        <div className="z-40 min-w-0 flex-1 rounded-xl border border-card-gold/30 bg-black/40 px-2 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-md landscape:rounded-md landscape:px-1.5 landscape:py-0">
        <div className="mx-auto flex max-w-7xl flex-nowrap items-center justify-center gap-2 landscape:gap-1.5">
          {sortedTeams.map(team => {
            const isMine = team.id === myTeamId
            const matchTotal = view.matchScores[team.id] + team.score
            const canastraCount = team.melds.filter(m => m.isCanastra).length
            return (
              <div
                key={team.id}
                className={`flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-0.5 ${
                  isMine ? 'border border-card-gold/50 bg-card-gold/10' : 'border border-fuchsia-400/40 bg-fuchsia-500/10'
                }`}
              >
                <span className={`font-display text-xs ${isMine ? 'text-card-gold' : 'text-fuchsia-300'}`}>
                  {TEAM_LABEL[isMine ? 'A' : 'B']}
                </span>
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
            )
          })}
        </div>
        </div>
      </div>

      {errorMsg && (
        <p className="shrink-0 rounded-xl bg-red-500/15 px-4 py-2 text-center text-sm text-red-200 landscape:py-1 landscape:text-xs">
          {errorMsg}
          <button type="button" onClick={clearError} className="ml-2 underline">
            ok
          </button>
        </p>
      )}

      {/* Mesa — mesmo tratamento do GameBoard offline: ocupa o espaço
          flexível do meio, sem rolar em paisagem. */}
      <div className="min-h-0 flex-1 overflow-y-auto landscape:overflow-hidden">
        <OnlineGameBoard view={view} />
      </div>

      {/* Registro — escondido em paisagem, igual offline */}
      <div className="shrink-0 truncate rounded-lg border border-white/10 bg-black/25 px-3 py-1.5 text-center text-xs text-gray-300 landscape:hidden">
        <span className="text-card-gold">Registro:</span> {lastLog ?? 'Nenhuma ação ainda.'}
      </div>

      {/* Rodapé: UM painel só com a Mão e o Descarte lado a lado ("em
          paralelo") — igual ao Gameplay offline. */}
      <div className="flex shrink-0 items-stretch gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-1.5 shadow-lg backdrop-blur-sm landscape:gap-1.5 landscape:px-2 landscape:py-0.5">
        <div className="min-w-0 flex-[3]">
          <OnlinePlayerHand view={view} />
        </div>
        <div className="w-px shrink-0 self-stretch bg-white/15" />
        <div className="min-w-0 flex-[2]">
          <OnlineDiscardRow view={view} />
        </div>
      </div>
    </div>
  )
}
