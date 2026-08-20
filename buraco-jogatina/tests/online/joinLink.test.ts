import { parseJoinLink } from '../../src/online/joinLink'

describe('parseJoinLink', () => {
  test('URL completa do QR: extrai servidor (host:porta) e código', () => {
    expect(parseJoinLink('http://192.168.2.142:3001/?sala=ABCDE')).toEqual({
      serverAddress: '192.168.2.142:3001',
      code: 'ABCDE',
    })
  })

  test('URL sem porta assume a porta padrão do servidor (3001)', () => {
    expect(parseJoinLink('http://192.168.2.142/?sala=ABCDE')).toEqual({
      serverAddress: '192.168.2.142:3001',
      code: 'ABCDE',
    })
  })

  test('endereço colado sem esquema também funciona', () => {
    expect(parseJoinLink('192.168.2.142:3001/?sala=ABCDE')).toEqual({
      serverAddress: '192.168.2.142:3001',
      code: 'ABCDE',
    })
  })

  test('código puro (QR antigo ou digitado): sem servidor, só o código', () => {
    expect(parseJoinLink('ABCDE')).toEqual({ serverAddress: '', code: 'ABCDE' })
  })

  test('código puro em minúsculas vira maiúsculas', () => {
    expect(parseJoinLink('abcde')).toEqual({ serverAddress: '', code: 'ABCDE' })
  })

  test('espaços em volta são ignorados', () => {
    expect(parseJoinLink('  http://10.0.0.9:3001/?sala=XYZ12  ')).toEqual({
      serverAddress: '10.0.0.9:3001',
      code: 'XYZ12',
    })
  })

  // localhost no QR apontaria pro PRÓPRIO aparelho de quem escaneia, nunca
  // pro servidor - por isso vira "sem servidor" (o app mantém o endereço
  // que já tiver configurado) em vez de quebrar a conexão.
  test('localhost/127.0.0.1 são descartados como servidor, mas o código é aproveitado', () => {
    expect(parseJoinLink('http://localhost:3001/?sala=ABCDE')).toEqual({
      serverAddress: '',
      code: 'ABCDE',
    })
    expect(parseJoinLink('http://127.0.0.1:3001/?sala=ABCDE')).toEqual({
      serverAddress: '',
      code: 'ABCDE',
    })
  })

  test('URL sem ?sala= ainda serve pra configurar só o servidor', () => {
    expect(parseJoinLink('http://192.168.2.142:3001/')).toEqual({
      serverAddress: '192.168.2.142:3001',
      code: '',
    })
  })

  test('QR aleatório (Wi-Fi, texto solto) é rejeitado com null', () => {
    expect(parseJoinLink('WIFI:S:MinhaRede;T:WPA;P:senha123;;')).toBeNull()
    expect(parseJoinLink('')).toBeNull()
    expect(parseJoinLink('   ')).toBeNull()
    expect(parseJoinLink('uma frase qualquer com espaços')).toBeNull()
  })

  test('https também é aceito (servidor atrás de proxy TLS)', () => {
    expect(parseJoinLink('https://buraco.exemplo.com/?sala=ABCDE')).toEqual({
      serverAddress: 'buraco.exemplo.com:3001',
      code: 'ABCDE',
    })
  })
})
