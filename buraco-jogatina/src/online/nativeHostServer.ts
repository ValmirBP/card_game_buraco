import { registerPlugin } from '@capacitor/core'
import { ProtocolServer } from '../../server/protocol'
import type { ClientMessage } from '../../server/protocol'

/**
 * Servidor multiplayer embutido no APK: deixa QUALQUER celular ser o host
 * de uma partida online, sem depender de um computador rodando
 * server/index.ts na mesma rede ("o telefone deve criar o servidor e ser o
 * host" - pedido do usuário; antes disso, o modo online exigia sempre um
 * PC de host, e o app pedia um IP:porta que nenhum celular sozinho conseguia
 * fornecer).
 *
 * O TRANSPORTE (aceitar conexões WebSocket reais de outros aparelhos na
 * rede) é feito nativamente em Android por HostServerPlugin.java, usando a
 * biblioteca Java-WebSocket (RFC6455 completo). Este módulo só faz a ponte:
 * conduz o MESMO ProtocolServer que o servidor de desktop usa, então
 * NENHUMA regra de jogo é duplicada - qualquer correção feita em
 * server/protocol.ts, server/rooms.ts ou src/session/GameSession.ts vale
 * automaticamente também para uma partida hospedada num celular.
 */

interface NativeHostStatus {
  running: boolean
  port?: number
  /** IP LAN deste aparelho (ex.: "192.168.2.169"), reportado pelo lado
   * nativo. Ausente se nenhuma interface de rede foi encontrada. */
  address?: string
}

interface HostServerPluginApi {
  start(opts: { port: number }): Promise<NativeHostStatus>
  stop(): Promise<void>
  send(opts: { connId: string; data: string }): Promise<void>
  status(): Promise<NativeHostStatus>
  addListener(
    eventName: 'connectionOpen' | 'connectionClosed',
    listenerFunc: (data: { connId: string }) => void
  ): Promise<{ remove: () => Promise<void> }>
  addListener(
    eventName: 'message',
    listenerFunc: (data: { connId: string; data: string }) => void
  ): Promise<{ remove: () => Promise<void> }>
}

const HostServer = registerPlugin<HostServerPluginApi>('HostServer')

export interface NativeHostInfo {
  /** IP LAN deste aparelho, ou null se nenhuma rede (Wi-Fi/Ethernet) foi
   * encontrada - nesse caso o QR não vai funcionar pra outros aparelhos
   * (mesma limitação que o servidor de desktop tem sem lanAddresses(); ver
   * `qrUsable` em OnlineLobby.tsx). */
  address: string | null
  port: number
}

let protocol: ProtocolServer | null = null
let subscriptions: Array<{ remove: () => Promise<void> }> = []
let running = false

/**
 * Sobe o servidor embutido neste aparelho e conecta o motor do jogo. Cada
 * conexão aceita pelo plugin nativo vira um `ClientSocket` cujo `send`
 * delega pro plugin (`HostServer.send`); cada mensagem que chega do plugin
 * alimenta `protocol.handleMessage`, igual a como server/index.ts faz com
 * `socket.on('message', ...)` no servidor de desktop.
 *
 * Idempotente: chamar de novo com o servidor já rodando devolve o status
 * atual sem reiniciar nada (a tela Online pode ser desmontada/remontada
 * sem duplicar servidor ou perder a sala em andamento).
 */
export async function startNativeHost(port = 3001): Promise<NativeHostInfo | null> {
  if (running) {
    const status = await HostServer.status().catch(() => null)
    if (!status?.running) {
      running = false
    } else {
      return { address: status.address ?? null, port: status.port ?? port }
    }
  }

  let result: NativeHostStatus
  try {
    result = await HostServer.start({ port })
  } catch {
    return null
  }
  if (!result.running) return null

  protocol = new ProtocolServer({
    serverUrl: result.address ? `http://${result.address}:${result.port ?? port}` : undefined,
  })
  const activeProtocol = protocol

  subscriptions = await Promise.all([
    HostServer.addListener('connectionOpen', ({ connId }) => {
      activeProtocol.registerConnection(connId, {
        send: (data: string) => {
          void HostServer.send({ connId, data })
        },
      })
    }),
    HostServer.addListener('message', ({ connId, data }) => {
      let msg: ClientMessage
      try {
        msg = JSON.parse(data)
      } catch {
        return
      }
      // Ao contrário de um processo Node, uma promise rejeitada aqui não
      // derruba o app - mas o .catch() evita um "unhandled rejection"
      // barulhento no console sem propósito nenhum (ver o mesmo ponto,
      // ainda pendente, em server/index.ts).
      activeProtocol.handleMessage(connId, msg).catch(() => {})
    }),
    HostServer.addListener('connectionClosed', ({ connId }) => {
      activeProtocol.handleClose(connId)
    }),
  ])

  running = true
  return { address: result.address ?? null, port: result.port ?? port }
}

/** Encerra o servidor embutido: a sala e a partida em andamento, se
 * houver, são perdidas — mesmo efeito de fechar o servidor de desktop.
 * Chamado ao sair da sala (ver onlineStore.leave) quando este aparelho é
 * quem hospeda. Seguro chamar mesmo se o servidor não estiver rodando. */
export async function stopNativeHost(): Promise<void> {
  if (!running) return
  running = false
  const toRemove = subscriptions
  subscriptions = []
  protocol = null
  await Promise.all(toRemove.map((sub) => sub.remove().catch(() => {})))
  try {
    await HostServer.stop()
  } catch {
    // best-effort: o app pode estar sendo fechado ao mesmo tempo.
  }
}

export function isNativeHostRunning(): boolean {
  return running
}
