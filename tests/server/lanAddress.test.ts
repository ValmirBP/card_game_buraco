import type { NetworkInterfaceInfo } from 'node:os'
import { lanAddresses, lanBaseUrl } from '../../server/lanAddress'

function ipv4(address: string, internal = false): NetworkInterfaceInfo {
  return { address, netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal, cidr: null }
}

describe('lanAddresses', () => {
  test('ignores internal (loopback) addresses', () => {
    const nets = { lo0: [ipv4('127.0.0.1', true)] }
    expect(lanAddresses(nets)).toEqual([])
  })

  test('prefers a real Wi-Fi/Ethernet interface over a VPN tunnel, regardless of enumeration order', () => {
    // Reproduz o bug real: usuário com VPN ativa (utun) tinha o Mac com DUAS
    // redes - a Wi-Fi de verdade (en0) e o túnel da VPN (utun4). Sem o
    // filtro, se o utun aparecesse primeiro na ordem do SO, o QR code/campo
    // "Entrar em uma Sala" sugeria um IP que só o próprio Mac alcançava,
    // nunca os celulares na mesma Wi-Fi.
    const nets = {
      utun4: [ipv4('192.168.180.3')],
      en0: [ipv4('192.168.2.142')],
    }
    expect(lanAddresses(nets)).toEqual(['192.168.2.142', '192.168.180.3'])
  })

  test('falls back to the VPN tunnel address when it is the only network available', () => {
    const nets = { utun4: [ipv4('192.168.180.3')] }
    expect(lanAddresses(nets)).toEqual(['192.168.180.3'])
  })

  test('recognizes common virtual-interface name patterns (tailscale, docker, wg, tap)', () => {
    const nets = {
      tailscale0: [ipv4('100.64.0.5')],
      docker0: [ipv4('172.17.0.1')],
      wg0: [ipv4('10.6.0.2')],
      tap0: [ipv4('10.8.0.3')],
      eth0: [ipv4('192.168.1.50')],
    }
    expect(lanAddresses(nets)).toEqual(['192.168.1.50', '100.64.0.5', '172.17.0.1', '10.6.0.2', '10.8.0.3'])
  })
})

describe('lanBaseUrl', () => {
  test('builds an http URL from the best address and the given port', () => {
    const nets = { en0: [ipv4('192.168.2.142')] }
    expect(lanBaseUrl(nets, 3001)).toBe('http://192.168.2.142:3001')
  })

  test('empty string when there is no network at all', () => {
    expect(lanBaseUrl({}, 3001)).toBe('')
  })
})
