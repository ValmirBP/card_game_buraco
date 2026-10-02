import type { NetworkInterfaceInfo } from 'node:os'

const VIRTUAL_INTERFACE_PATTERN = /^(utun|ppp|tun|tap|wg|tailscale|zt|awdl|llw|bridge|docker|vmnet|veth)/i

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

export function lanBaseUrl(nets: NodeJS.Dict<NetworkInterfaceInfo[]>, port: number): string {
  const addresses = lanAddresses(nets)
  return addresses.length > 0 ? `http://${addresses[0]}:${port}` : ''
}
