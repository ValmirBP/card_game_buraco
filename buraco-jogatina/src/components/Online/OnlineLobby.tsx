import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import QRCode from 'qrcode'
import { Capacitor } from '@capacitor/core'
import { useOnlineStore, joinUrlFor } from '../../online/onlineStore'
import DifficultySelector from '../Menu/DifficultySelector'
import QrScanner, { canScanQr } from './QrScanner'
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
  const serverAddress = useOnlineStore((s) => s.serverAddress)
  const setServerAddress = useOnlineStore((s) => s.setServerAddress)
  const createRoom = useOnlineStore((s) => s.create)
  const joinRoom = useOnlineStore((s) => s.join)
  const joinFromScannedLink = useOnlineStore((s) => s.joinFromScannedLink)
  const startRoom = useOnlineStore((s) => s.start)
  const clearError = useOnlineStore((s) => s.clearError)
  const chooseSeat = useOnlineStore((s) => s.chooseSeat)
  const renameSeat = useOnlineStore((s) => s.rename)

  const [inviteCode] = useState(readInviteCodeFromUrl)
  const [name, setName] = useState('Você')
  // "Criar Sala" no APK instalado sobe o servidor embutido NESTE aparelho
  // (ver src/online/nativeHostServer.ts) antes de criar a sala — nenhum
  // computador precisa estar ligado. hostStarting cobre o intervalo entre
  // o clique e o servidor responder; hostError é só dessa etapa (falha
  // aqui nunca chega a abrir um WebSocket, então não é o `errorMsg` do
  // store, que é sobre a CONEXÃO).
  const [hostStarting, setHostStarting] = useState(false)
  const [hostError, setHostError] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState(inviteCode ?? '')
  const [showScanner, setShowScanner] = useState(false)
  // Calculado uma vez: a câmera/decodificador existem neste aparelho? Só
  // mostra o botão onde ele de fato funciona (ver canScanQr).
  const [scanSupported] = useState(canScanQr)

  /**
   * QR lido: delega pro store, que configura o endereço do servidor embutido
   * no link e entra na sala — o passo manual ("digite o IP do computador")
   * que o segundo aparelho tinha que fazer. Retorna false pra QR que não é
   * um convite, pro scanner continuar lendo em vez de fechar.
   */
  const handleScan = (raw: string): boolean => {
    const entered = joinFromScannedLink(raw, name.trim() || 'Você')
    if (entered) setShowScanner(false)
    return entered
  }
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>(inviteCode ? 'join' : 'choose')
  const [showDifficulty, setShowDifficulty] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  // No APK instalado (native), "mesma origem" nunca funciona (a página é
  // servida de capacitor://localhost/https://localhost, sem nada a ver com
  // o servidor de verdade) - por isso o campo já abre expandido lá. No
  // navegador (onde o padrão same-origin já funciona sozinho na maioria dos
  // casos), fica escondido atrás de "Avançado" a menos que já tenha um
  // endereço salvo de uma sessão anterior.
  const [showServerAddress, setShowServerAddress] = useState(
    () => Capacitor.isNativePlatform() || serverAddressInitiallySet()
  )

  function serverAddressInitiallySet(): boolean {
    return useOnlineStore.getState().serverAddress.trim().length > 0
  }

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

  // Um QR só serve pra quem escaneia se apontar pra um endereço alcançável
  // NA REDE. Sem serverUrl ele viraria window.location.origin (localhost no
  // APK) - ver o aviso na tela da sala.
  const qrUsable = Boolean(qrDataUrl) && Boolean(serverUrl)

  const handleCreate = async (difficulty: AIDifficulty) => {
    setShowDifficulty(false)
    setHostError(null)

    // No app instalado, este aparelho vira o próprio host: sobe o
    // servidor embutido (Java-WebSocket dentro do APK, ver
    // HostServerPlugin.java) e usa o IP de rede DELE MESMO, em vez de
    // pedir o IP de um computador que o usuário talvez nem tenha por
    // perto. No navegador (não-nativo) nada muda — cria a sala como
    // sempre, contra o serverAddress já configurado.
    if (Capacitor.isNativePlatform()) {
      setHostStarting(true)
      const { startNativeHost } = await import('../../online/nativeHostServer')
      const info = await startNativeHost()
      setHostStarting(false)
      if (!info) {
        setHostError('Não foi possível criar o servidor neste aparelho. Tente novamente.')
        return
      }
      // Sem IP de rede (ex.: sem Wi-Fi conectado): ainda assim usa
      // 127.0.0.1 pra ESTE aparelho conseguir se conectar ao próprio
      // servidor e jogar sozinho contra as IAs — só o QR/convite pra
      // outros aparelhos é que não vai funcionar (mesmo aviso que já
      // existe pra um servidor de desktop sem LAN, via `qrUsable`).
      setServerAddress(info.address ? `${info.address}:${info.port}` : `127.0.0.1:${info.port}`)
    }

    createRoom(name.trim() || 'Você', difficulty)
  }

  const handleJoin = () => {
    const trimmed = joinCode.trim().toUpperCase()
    if (!trimmed) return
    joinRoom(trimmed, name.trim() || 'Você')
  }

  const inRoom = code !== null

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6 text-center landscape:justify-start landscape:gap-1.5 landscape:overflow-y-auto landscape:py-1">
      <h1 className="font-display text-3xl text-card-gold drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] sm:text-4xl landscape:text-xl">
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

      {hostStarting && (
        <p className="w-full max-w-sm rounded-xl bg-card-gold/10 px-4 py-2 text-sm text-card-gold">
          Criando o servidor neste aparelho…
        </p>
      )}

      {hostError && (
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm rounded-xl bg-red-500/15 px-4 py-2 text-sm text-red-200"
        >
          {hostError}
          <button type="button" onClick={() => setHostError(null)} className="ml-2 underline">
            ok
          </button>
        </motion.p>
      )}

      {/* Mesmo PADRÃO da tela inicial (Menu.tsx): em paisagem vira uma grade
          de 2 colunas — esquerda com o nome/config, direita com os botões —
          o que faz tudo caber sem rolagem. Em retrato continua empilhado. */}
      {!inRoom && (
        <div className="grid w-full max-w-sm grid-cols-1 gap-4 landscape:max-w-3xl landscape:grid-cols-2 landscape:items-start landscape:gap-4 landscape:px-4">
          <div className="space-y-4 landscape:space-y-1.5">
            <label htmlFor="online-name" className="sr-only">
              Seu nome
            </label>
            <input
              id="online-name"
              type="text"
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center text-white placeholder-gray-400 shadow-inner outline-none backdrop-blur-sm transition focus:ring-4 focus:ring-card-gold/70 landscape:min-h-0 landscape:py-1.5 landscape:text-sm"
            />

            <div>
            <button
              type="button"
              onClick={() => setShowServerAddress((v) => !v)}
              className="w-full text-center text-xs text-gray-400 underline decoration-dotted underline-offset-4 hover:text-card-gold"
            >
              {showServerAddress ? 'Ocultar endereço do servidor' : 'Avançado: endereço do servidor'}
            </button>
            {showServerAddress && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 overflow-hidden"
              >
                <label htmlFor="server-address" className="sr-only">
                  Endereço do servidor
                </label>
                <input
                  id="server-address"
                  type="text"
                  inputMode="url"
                  autoCapitalize="off"
                  autoCorrect="off"
                  placeholder="ex.: 192.168.2.142:3001 (deixe vazio se abriu isso num navegador)"
                  value={serverAddress}
                  onChange={(e) => setServerAddress(e.target.value)}
                  className="min-h-[40px] w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-center text-sm text-white placeholder-gray-500 shadow-inner outline-none backdrop-blur-sm transition focus:ring-4 focus:ring-card-gold/70"
                />
                <p className="mt-1 text-[10px] text-gray-500">
                  Só necessário pra ENTRAR na sala de outra pessoa (digite o IP e a porta do aparelho que
                  criou a sala, ex.: 192.168.2.142:3001) — escanear o QR preenche isso sozinho. Pra CRIAR
                  uma sala no app instalado, não precisa digitar nada: este aparelho vira o servidor.
                </p>
              </motion.div>
            )}
            </div>
          </div>

          {mode === 'choose' && (
            <div className="flex flex-col gap-3 landscape:gap-1.5">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowDifficulty(true)}
                disabled={hostStarting}
                className="min-h-[44px] w-full rounded-xl bg-gradient-to-b from-card-gold-light to-card-gold px-6 py-3 font-bold text-black shadow-lg shadow-black/30 transition-colors hover:from-card-gold hover:to-card-gold-dark landscape:min-h-0 landscape:py-1.5 landscape:text-sm disabled:opacity-50"
              >
                {hostStarting ? 'Criando…' : 'Criar Sala'}
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setMode('join')}
                className="min-h-[44px] w-full rounded-xl border-2 border-card-gold/70 bg-black/20 px-6 py-3 font-bold text-card-gold backdrop-blur-sm transition-colors hover:bg-card-gold/10 landscape:min-h-0 landscape:py-1.5 landscape:text-sm"
              >
                Entrar em uma Sala
              </motion.button>
              {/* Caminho SEM digitação: lê o QR do outro celular e já
                  configura endereço do servidor + código da sala. */}
              {scanSupported && (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowScanner(true)}
                  className="min-h-[44px] w-full rounded-xl border-2 border-card-gold/70 bg-black/20 px-6 py-3 font-bold text-card-gold backdrop-blur-sm transition-colors hover:bg-card-gold/10 landscape:min-h-0 landscape:py-1.5 landscape:text-sm"
                >
                  📷 Escanear QR
                </motion.button>
              )}
            </div>
          )}

          {mode === 'join' && (
            <div className="flex flex-col gap-3 landscape:gap-1.5">
              <input
                type="text"
                placeholder="Código da sala"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={5}
                className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center font-display text-2xl tracking-[0.3em] text-card-gold placeholder-gray-500 shadow-inner outline-none backdrop-blur-sm transition focus:ring-4 focus:ring-card-gold/70 landscape:min-h-0 landscape:py-1 landscape:text-lg"
              />
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleJoin}
                disabled={connection === 'connecting'}
                className="min-h-[44px] w-full rounded-xl bg-gradient-to-b from-card-gold-light to-card-gold px-6 py-3 font-bold text-black shadow-lg shadow-black/30 transition-colors hover:from-card-gold hover:to-card-gold-dark landscape:min-h-0 landscape:py-1.5 landscape:text-sm disabled:opacity-50"
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

      {/* Mesmo padrão do bloco !inRoom: em paisagem vira grade de 2 colunas
          (esquerda = código + QR, direita = assentos + iniciar), senão o
          painel empilhado estoura a altura de um celular e "Iniciar Partida"
          fica fora da tela, sem rolagem pra alcançar. */}
      {inRoom && (
        <div className="w-full max-w-sm space-y-6 landscape:max-w-3xl landscape:grid landscape:grid-cols-2 landscape:items-start landscape:gap-x-4 landscape:gap-y-1.5 landscape:space-y-0 landscape:px-4">
          <div className="rounded-2xl border border-card-gold/40 bg-black/25 p-6 shadow-lg backdrop-blur-sm landscape:col-start-1 landscape:row-start-1 landscape:p-2">
            <p className="text-xs uppercase tracking-wide text-gray-300 landscape:text-[10px]">Código da sala</p>
            <p className="font-display text-5xl tracking-[0.3em] text-card-gold drop-shadow-[0_2px_10px_rgba(212,175,55,0.5)] landscape:text-3xl">
              {code}
            </p>
            <p className="mt-2 text-xs text-gray-400 landscape:mt-0.5 landscape:text-[10px]">Compartilhe este código para outros entrarem</p>
          </div>

          {/* Sem `serverUrl` (servidor sem IP de LAN — ver lanBaseUrl em
              server/lanAddress.ts), joinUrlFor cai em window.location.origin,
              que dentro do APK é http://localhost: um QR que aponta pro
              PRÓPRIO aparelho de quem escaneia e nunca conecta. Melhor
              avisar do que desenhar um QR inútil. */}
          {qrUsable ? (
            <div className="flex flex-col items-center gap-2 landscape:col-start-1 landscape:row-start-2 landscape:gap-1">
              <div className="rounded-2xl bg-white p-3 shadow-lg landscape:p-1.5">
                <img src={qrDataUrl!} alt="QR code para entrar na sala" width={200} height={200} className="block landscape:h-28 landscape:w-28" />
              </div>
              <p className="text-xs text-gray-400 landscape:text-[10px]">Aponte a câmera do outro celular para entrar</p>
            </div>
          ) : (
            <p className="rounded-xl bg-amber-500/15 px-4 py-2 text-xs text-amber-200 landscape:col-start-1 landscape:row-start-2 landscape:py-1 landscape:text-[10px]">
              O servidor não informou um endereço de rede, então o QR não funcionaria. Compartilhe o código
              acima e o IP do computador manualmente.
            </p>
          )}

          <div className="space-y-2 text-left landscape:col-start-2 landscape:row-start-1 landscape:space-y-1">
            {SEAT_LABELS.map((label, i) => {
              const seatInfo = lobby.find((s) => s.index === i)
              const isYou = seat === i
              // "Escolher o lado que quer entrar": qualquer convidado (não
              // o anfitrião, que trava a sala pra sempre se sair do
              // assento 0 - ver rooms.ts) pode tocar num assento AI livre
              // pra se mudar pra lá, antes da partida começar.
              const canMoveHere = !isYou && !isHost && seatInfo?.kind === 'ai'

              if (isYou) {
                return <YourSeatRow key={i} name={seatInfo?.name ?? label} onRename={renameSeat} />
              }

              return (
                <button
                  key={i}
                  type="button"
                  disabled={!canMoveHere}
                  onClick={canMoveHere ? () => chooseSeat(i) : undefined}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left landscape:py-1 ${
                    canMoveHere
                      ? 'cursor-pointer border-white/10 bg-white/5 transition-colors hover:border-card-gold/60 hover:bg-card-gold/10'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <span className="text-sm text-gray-200 landscape:text-xs">{seatInfo?.name ?? label}</span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-400 landscape:text-[10px]">
                    {canMoveHere && (
                      <span className="text-card-gold landscape:hidden">Toque para entrar aqui</span>
                    )}
                    {seatInfo?.kind === 'human'
                      ? seatInfo.connected
                        ? '🧑 humano'
                        : '🧑 humano (offline)'
                      : '🤖 IA'}
                  </span>
                </button>
              )
            })}
          </div>

          {isHost ? (
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={startRoom}
              className="min-h-[44px] w-full rounded-xl bg-gradient-to-b from-card-gold-light to-card-gold px-6 py-3 font-bold text-black shadow-lg shadow-black/30 transition-colors hover:from-card-gold hover:to-card-gold-dark landscape:col-start-2 landscape:row-start-2 landscape:mt-1 landscape:min-h-0 landscape:py-1.5 landscape:text-sm"
            >
              Iniciar Partida
            </motion.button>
          ) : (
            <p className="text-sm text-gray-300 landscape:col-start-2 landscape:row-start-2 landscape:mt-1 landscape:text-xs">Aguardando o host iniciar a partida…</p>
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

      <AnimatePresence>
        {showScanner && <QrScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
      </AnimatePresence>
    </div>
  )
}

interface YourSeatRowProps {
  name: string
  onRename: (name: string) => void
}

/** Sua própria linha na lista de assentos: nome + "(você)" e um lápis pra
 * editar — toca, digita, confirma (Enter ou ✓) ou cancela (Esc ou ✕). Vale
 * tanto pro anfitrião quanto pra convidados: renomear não tem a mesma
 * restrição de trocar de assento (ver rooms.ts `rename`). */
function YourSeatRow({ name, onRename }: YourSeatRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== name) onRename(trimmed)
    setEditing(false)
  }

  const cancel = () => {
    setDraft(name)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 rounded-xl border border-card-gold bg-card-gold/10 px-3 py-2 landscape:py-1">
        <input
          autoFocus
          type="text"
          value={draft}
          maxLength={24}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') cancel()
          }}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-card-gold/70 landscape:text-xs"
        />
        <button type="button" onClick={commit} className="shrink-0 px-1 text-card-gold" aria-label="Confirmar nome">
          ✓
        </button>
        <button type="button" onClick={cancel} className="shrink-0 px-1 text-gray-400" aria-label="Cancelar edição">
          ✕
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-card-gold bg-card-gold/10 px-4 py-2.5 landscape:py-1">
      <span className="flex min-w-0 items-center gap-1.5 text-sm text-gray-200 landscape:text-xs">
        <span className="truncate">{name} (você)</span>
        <button
          type="button"
          onClick={() => {
            setDraft(name)
            setEditing(true)
          }}
          className="shrink-0 text-gray-400 underline decoration-dotted underline-offset-2 hover:text-card-gold"
          aria-label="Editar nome"
        >
          ✎
        </button>
      </span>
      <span className="shrink-0 text-xs text-gray-400 landscape:text-[10px]">🧑 humano</span>
    </div>
  )
}
