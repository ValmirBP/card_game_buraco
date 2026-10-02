export interface JoinLink {
  serverAddress: string
  code: string
}

const DEFAULT_PORT = '3001'

export function parseJoinLink(raw: string): JoinLink | null {
  const text = raw.trim()
  if (!text) return null

  if (/^[A-Za-z0-9]{4,8}$/.test(text) && !text.includes('/')) {
    return { serverAddress: '', code: text.toUpperCase() }
  }

  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(text) ? text : `http://${text}`

  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }

  const code = (url.searchParams.get('sala') ?? '').trim().toUpperCase()

  const host = url.hostname
  const isUselessHost = !host || host === 'localhost' || host === '127.0.0.1' || host === '::1'

  const serverAddress = isUselessHost ? '' : `${host}:${url.port || DEFAULT_PORT}`

  if (!serverAddress && !code) return null
  return { serverAddress, code }
}
