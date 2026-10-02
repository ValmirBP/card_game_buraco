/** @jest-environment node */
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { joinUrlFor } from '../../src/online/onlineStore'
import { parseJoinLink } from '../../src/online/joinLink'

const SCALE = 4
const QUIET_ZONE = 4

function renderQrToImageData(text: string): { data: Uint8ClampedArray; width: number; height: number } {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const size = qr.modules.size
  const modules = qr.modules.data
  const dim = (size + QUIET_ZONE * 2) * SCALE
  const data = new Uint8ClampedArray(dim * dim * 4)

  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      const mx = Math.floor(x / SCALE) - QUIET_ZONE
      const my = Math.floor(y / SCALE) - QUIET_ZONE
      const inside = mx >= 0 && my >= 0 && mx < size && my < size
      const dark = inside ? modules[my * size + mx] === 1 : false
      const v = dark ? 0 : 255
      const i = (y * dim + x) * 4
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
  }
  return { data, width: dim, height: dim }
}

describe('QR da sala: geração → leitura → dados de conexão', () => {
  test('o QR gerado pela tela da sala é legível e entrega servidor + código', () => {
    const url = joinUrlFor('ABCDE', 'http://192.168.2.142:3001')
    expect(url).toBe('http://192.168.2.142:3001/?sala=ABCDE')

    const { data, width, height } = renderQrToImageData(url)
    const decoded = jsQR(data, width, height, { inversionAttempts: 'dontInvert' })

    expect(decoded).not.toBeNull()
    expect(decoded!.data).toBe(url)

    expect(parseJoinLink(decoded!.data)).toEqual({
      serverAddress: '192.168.2.142:3001',
      code: 'ABCDE',
    })
  })

  test('funciona com outro IP/código (não é caso isolado)', () => {
    const url = joinUrlFor('XY7Z9', 'http://10.0.0.42:3001')
    const { data, width, height } = renderQrToImageData(url)
    const decoded = jsQR(data, width, height, { inversionAttempts: 'dontInvert' })

    expect(decoded!.data).toBe(url)
    expect(parseJoinLink(decoded!.data)).toEqual({
      serverAddress: '10.0.0.42:3001',
      code: 'XY7Z9',
    })
  })
})
