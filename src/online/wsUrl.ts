/**
 * Resolves the WebSocket URL to connect to. `explicitAddress` (trimmed) can
 * be:
 *  - empty: mesma origem da página (comportamento original/único antes deste
 *    campo existir — funciona quando a própria página é servida PELO
 *    servidor do jogo, ex.: navegador aberto em http://192.168.x.x:3001).
 *  - "host:porta" ou "host": esquema inferido do protocolo da página atual
 *    (ws: para http:, wss: para https:).
 *  - uma URL completa "ws://…"/"wss://…": usada como está.
 *  - uma URL completa "http://…"/"https://…" (ex.: colada da barra de
 *    endereço do navegador): esquema trocado para ws/wss, resto mantido.
 *
 * Existe porque dentro do APK a página é servida de `capacitor://localhost`
 * ou `https://localhost` — sem um endereço explícito, o WebSocket tentava
 * se conectar no PRÓPRIO aparelho e nunca funcionava (ver onlineStore.ts).
 */
export function resolveWsUrl(
  explicitAddress: string,
  pageProtocol: string = window.location.protocol,
  pageHost: string = window.location.host
): string {
  const trimmed = explicitAddress.trim()

  if (!trimmed) {
    // Mesma origem: o esquema precisa bater com o da própria página (só faz
    // sentido quando a página é servida PELO servidor do jogo).
    const sameOriginScheme = pageProtocol === 'https:' ? 'wss:' : 'ws:'
    return `${sameOriginScheme}//${pageHost}`
  }

  const schemeMatch = trimmed.match(/^(\w+):\/\//)
  if (!schemeMatch) {
    // Endereço explícito sem esquema (o caso comum: usuário digitou só o IP
    // do PC, ex. "192.168.2.142:3001"). O servidor do jogo (server/index.ts)
    // fala ws SIMPLES, sem TLS — então é sempre ws: aqui, independente do
    // esquema da própria página, que dentro do APK é https://localhost ou
    // capacitor://localhost e não tem nada a ver com o servidor de verdade.
    return `ws://${trimmed}`
  }

  const scheme = schemeMatch[1].toLowerCase()
  const rest = trimmed.slice(schemeMatch[0].length)
  if (scheme === 'ws' || scheme === 'wss') return trimmed
  if (scheme === 'http') return `ws://${rest}`
  if (scheme === 'https') return `wss://${rest}`
  return `ws://${rest}` // esquema desconhecido: assume ws
}
