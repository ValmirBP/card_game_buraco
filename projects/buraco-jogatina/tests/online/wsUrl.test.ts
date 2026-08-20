import { resolveWsUrl } from '../../src/online/wsUrl'

describe('resolveWsUrl', () => {
  test('empty address falls back to same-origin (ws: for http:)', () => {
    expect(resolveWsUrl('', 'http:', 'localhost:3001')).toBe('ws://localhost:3001')
  })

  test('empty address falls back to same-origin (wss: for https:)', () => {
    expect(resolveWsUrl('', 'https:', 'example.com')).toBe('wss://example.com')
  })

  test('bare "host:port" is always ws:, regardless of the page protocol', () => {
    expect(resolveWsUrl('192.168.2.142:3001', 'http:', 'localhost')).toBe('ws://192.168.2.142:3001')
  })

  test('bare "host:port" stays ws: even when the page itself is https (APK/Capacitor case)', () => {
    // Este é o caso real dentro do APK: a página é servida de
    // https://localhost (Capacitor), e o usuário digita só o IP do PC. O
    // servidor do jogo fala ws simples (sem TLS), então NUNCA deve virar
    // wss: só porque a página do app está em https:.
    expect(resolveWsUrl('192.168.2.142:3001', 'https:', 'localhost')).toBe('ws://192.168.2.142:3001')
  })

  test('explicit "ws://" URL is used verbatim', () => {
    expect(resolveWsUrl('ws://192.168.2.142:3001')).toBe('ws://192.168.2.142:3001')
  })

  test('explicit "wss://" URL is used verbatim', () => {
    expect(resolveWsUrl('wss://meuservidor.com')).toBe('wss://meuservidor.com')
  })

  test('a pasted "http://" URL is normalized to ws://', () => {
    expect(resolveWsUrl('http://192.168.2.142:3001')).toBe('ws://192.168.2.142:3001')
  })

  test('a pasted "https://" URL is normalized to wss://', () => {
    expect(resolveWsUrl('https://meuservidor.com')).toBe('wss://meuservidor.com')
  })

  test('trims surrounding whitespace', () => {
    expect(resolveWsUrl('  192.168.2.142:3001  ', 'http:', 'localhost')).toBe('ws://192.168.2.142:3001')
  })

  test('bare host without port works too', () => {
    expect(resolveWsUrl('meuservidor.local', 'http:', 'localhost')).toBe('ws://meuservidor.local')
  })
})
