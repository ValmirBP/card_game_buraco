import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { networkInterfaces } from 'node:os'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, WebSocket } from 'ws'
import { ProtocolServer, ClientMessage } from './protocol'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.resolve(__dirname, '..', 'dist')
const PORT = Number(process.env.PORT) || 3001

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
  let filePath = path.join(DIST_DIR, decodeURIComponent(url.pathname))

  if (!filePath.startsWith(DIST_DIR)) {
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
  const nets = networkInterfaces()
  const addresses: string[] = []
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address)
      }
    }
  }
  return addresses
}

const httpServer = createServer((req, res) => {
  void serveStatic(req, res)
})

const wss = new WebSocketServer({ server: httpServer })
const protocol = new ProtocolServer()

let nextConnId = 1

wss.on('connection', (socket: WebSocket) => {
  const connId = `conn-${nextConnId++}`
  protocol.registerConnection(connId, {
    send: (data: string) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(data)
    },
  })

  socket.on('message', (raw) => {
    let msg: ClientMessage
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }
    void protocol.handleMessage(connId, msg)
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
