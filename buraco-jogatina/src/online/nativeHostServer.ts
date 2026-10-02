import { registerPlugin } from '@capacitor/core'
import { ProtocolServer } from '../../server/protocol'
import type { ClientMessage } from '../../server/protocol'

interface NativeHostStatus {
  running: boolean
  port?: number
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
  address: string | null
  port: number
}

let protocol: ProtocolServer | null = null
let subscriptions: Array<{ remove: () => Promise<void> }> = []
let running = false

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
      activeProtocol.handleMessage(connId, msg).catch(() => {})
    }),
    HostServer.addListener('connectionClosed', ({ connId }) => {
      activeProtocol.handleClose(connId)
    }),
  ])

  running = true
  return { address: result.address ?? null, port: result.port ?? port }
}

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
  }
}

export function isNativeHostRunning(): boolean {
  return running
}
