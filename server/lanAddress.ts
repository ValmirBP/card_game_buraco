import type { NetworkInterfaceInfo } from 'node:os'

/** Nomes de interface de VPN/túnel (utun no macOS, tun/tap no Linux, wg do
 * WireGuard, tailscale, zerotier...) — nunca são a rede local de verdade que
 * um celular no mesmo Wi-Fi consegue alcançar, então nunca devem virar o
 * endereço sugerido pro QR code/"Entrar em uma Sala". Sem esse filtro, se o
 * usuário tiver uma VPN ativa, a ordem de `Object.keys(networkInterfaces())`
 * não é garantida — o túnel pode aparecer ANTES da Wi-Fi de verdade — e o QR
 * acaba apontando pra um IP que só o próprio computador alcança. */
const VIRTUAL_INTERFACE_PATTERN = /^(utun|ppp|tun|tap|wg|tailscale|zt|awdl|llw|bridge|docker|vmnet|veth)/i

/** Non-internal IPv4 addresses across all interfaces, real Wi-Fi/Ethernet
 * first and VPN/tunnel interfaces last (only used as a last resort, if no
 * real network is available). */
export function lanAddresses(nets: NodeJS.Dict<NetworkInterfaceInfo[]>): string[] {
  const real: string[] = []
  const virtual: string[] = []
  for (const name of Object.keys(nets)) {
    const bucket = VIRTUAL_INTERFACE_PATTERN.test(name) ? virtual : real
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        bucket.push(net.address)
      }
    }
  }
  return [...real, ...virtual]
}

/** Best LAN base URL (first non-internal IPv4, preferring Wi-Fi/Ethernet
 * over VPN tunnels) with the given port, e.g. `http://192.168.2.169:3001`.
 * Empty if no network IP is available at all. */
export function lanBaseUrl(nets: NodeJS.Dict<NetworkInterfaceInfo[]>, port: number): string {
  const addresses = lanAddresses(nets)
  return addresses.length > 0 ? `http://${addresses[0]}:${port}` : ''
}
