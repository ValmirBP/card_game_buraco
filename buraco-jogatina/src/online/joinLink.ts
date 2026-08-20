/**
 * Leitura do "link de convite" que o QR code da sala carrega.
 *
 * O QR continua sendo uma URL http NORMAL (ex.:
 * `http://192.168.2.142:3001/?sala=ABCDE`), de propósito:
 *
 *  - escaneado pela câmera de um celular SEM o app: abre o jogo no
 *    navegador, servido pelo próprio servidor da sala, e o `?sala=` já
 *    preenche o código (comportamento que sempre existiu — não regride).
 *  - escaneado pelo leitor DENTRO do app: `parseJoinLink` extrai o
 *    endereço do servidor (host:porta) e o código, que é justamente o que
 *    o segundo aparelho precisa e hoje o usuário digita à mão.
 *
 * Um formato proprietário (ex.: `buraco://...`) daria os mesmos dados, mas
 * quebraria o caso do navegador — por isso a URL normal.
 */

export interface JoinLink {
  /** "host:porta" pronto pra `resolveWsUrl` (ver wsUrl.ts). Vazio quando o
   * link não traz servidor (ex.: QR gerado sem IP de LAN disponível — ver
   * server/lanAddress.ts): nesse caso quem escaneia mantém o endereço que
   * já tiver configurado. */
  serverAddress: string
  /** Código da sala em MAIÚSCULAS, ou '' se o link não tiver `?sala=`. */
  code: string
}

/** Porta padrão do servidor do jogo (server/index.ts). Um link sem porta
 * explícita (ex.: `http://192.168.2.142/?sala=X`) assume esta. */
const DEFAULT_PORT = '3001'

/**
 * Extrai servidor + código de um texto escaneado. Aceita:
 *  - URL completa: `http://192.168.2.142:3001/?sala=ABCDE`
 *  - URL sem porta: `http://192.168.2.142/?sala=ABCDE` (assume 3001)
 *  - URL sem esquema: `192.168.2.142:3001/?sala=ABCDE`
 *  - só o código: `ABCDE` (QR antigo/manual — servidor fica vazio)
 *
 * Retorna null se o texto não tiver NEM servidor NEM código utilizáveis,
 * pra o leitor poder ignorar um QR aleatório (Wi-Fi, boleto, etc.) e
 * continuar escaneando em vez de "conectar" em lixo.
 */
export function parseJoinLink(raw: string): JoinLink | null {
  const text = raw.trim()
  if (!text) return null

  // Caso simples: o conteúdo é só o código da sala (5 letras/dígitos).
  if (/^[A-Za-z0-9]{4,8}$/.test(text) && !text.includes('/')) {
    return { serverAddress: '', code: text.toUpperCase() }
  }

  // `new URL` exige esquema; adiciona um provisório quando falta, pra
  // aceitar "192.168.2.142:3001/?sala=X" colado da barra de endereço.
  // ATENÇÃO: sem a barra, "192.168.2.142:3001" seria lido como
  // esquema "192.168.2.142" + caminho "3001" — daí o teste de `//`.
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(text) ? text : `http://${text}`

  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }

  const code = (url.searchParams.get('sala') ?? '').trim().toUpperCase()

  // localhost num QR é inútil pra QUEM ESCANEIA (apontaria pro próprio
  // aparelho, não pro servidor) - trata como "sem servidor".
  const host = url.hostname
  const isUselessHost = !host || host === 'localhost' || host === '127.0.0.1' || host === '::1'

  const serverAddress = isUselessHost ? '' : `${host}:${url.port || DEFAULT_PORT}`

  if (!serverAddress && !code) return null
  return { serverAddress, code }
}
