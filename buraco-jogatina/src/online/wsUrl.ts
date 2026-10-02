export function resolveWsUrl(
  explicitAddress: string,
  pageProtocol: string = window.location.protocol,
  pageHost: string = window.location.host
): string {
  const trimmed = explicitAddress.trim()

  if (!trimmed) {
    const sameOriginScheme = pageProtocol === 'https:' ? 'wss:' : 'ws:'
    return `${sameOriginScheme}//${pageHost}`
  }

  const schemeMatch = trimmed.match(/^(\w+):\/\//)
  if (!schemeMatch) {
    return `ws://${trimmed}`
  }

  const scheme = schemeMatch[1].toLowerCase()
  const rest = trimmed.slice(schemeMatch[0].length)
  if (scheme === 'ws' || scheme === 'wss') return trimmed
  if (scheme === 'http') return `ws://${rest}`
  if (scheme === 'https') return `wss://${rest}`
  return `ws://${rest}`
}
