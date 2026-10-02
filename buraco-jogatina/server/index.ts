import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { networkInterfaces } from 'node:os'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, WebSocket } from 'ws'
import { ProtocolServer } from './protocol'
import { lanAddresses as computeLanAddresses, lanBaseUrl as computeLanBaseUrl } from './lanAddress'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.resolve(__dirname, '..', 'dist')
const PORT = Number(process.env.PORT) || 3001
const MAX_MESSAGE_BYTES = 4096

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
}

async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  let decoded: string
  try {
    decoded = decodeURIComponent(url.pathname)
  } catch {
    res.writeHead(400)
    res.end('Bad request')
    return
  }
  let filePath = path.join(DIST_DIR, decoded)

  if (filePath !== DIST_DIR && !filePath.startsWith(DIST_DIR + path.sep)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }
  if (url.pathname === '/' || !existsSync(filePath) || (await isDirectory(filePath))) {
    filePath = path.join(DIST_DIR, 'index.html')
  }

  try {
    const data = await readFile(filePath)
    const ext = path.extname(filePath)
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
}

async function isDirectory(filePath: string): Promise<boolean> {
  try {
    const { statSync } = await import('node:fs')
    return statSync(filePath).isDirectory()
  } catch {
    return false
  }
}

function lanAddresses(): string[] {
  return computeLanAddresses(networkInterfaces())
}

function lanBaseUrl(): string {
  return computeLanBaseUrl(networkInterfaces(), PORT)
}

const httpServer = createServer((req, res) => {
  serveStatic(req, res).catch(() => {
    if (!res.headersSent) res.writeHead(500)
    res.end('Internal error')
  })
})

const wss = new WebSocketServer({ server: httpServer, maxPayload: MAX_MESSAGE_BYTES })
const protocol = new ProtocolServer({ serverUrl: lanBaseUrl() })

let nextConnId = 1

wss.on('connection', (socket: WebSocket) => {
  const connId = `conn-${nextConnId++}`
  protocol.registerConnection(connId, {
    send: (data: string) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(data)
    },
  })

  socket.on('message', (raw) => {
    let msg: unknown
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }
    protocol.handleMessage(connId, msg).catch((err) => console.error('Erro nao tratado na mensagem:', err))
  })

  socket.on('close', () => {
    protocol.handleClose(connId)
  })
})

httpServer.listen(PORT, () => {
  console.log(`Buraco multiplayer server rodando na porta ${PORT}`)
  console.log(`  Local:   http://localhost:${PORT}`)
  for (const ip of lanAddresses()) {
    console.log(`  Na rede: http://${ip}:${PORT}`)
  }
})

process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason)
})
