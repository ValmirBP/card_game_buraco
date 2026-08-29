import { RoomManager } from '../../server/rooms'

describe('RoomManager', () => {
  it('createRoom generates a unique code with allowed charset', () => {
    const rm = new RoomManager()
    const { code } = rm.createRoom('conn-host', 'Host', 'medium')
    expect(code).toMatch(/^[A-Z0-9]{4,6}$/)
    // no ambiguous chars
    expect(code).not.toMatch(/[O0I1]/)
  })

  it('createRoom generates unique codes across many rooms', () => {
    const rm = new RoomManager()
    const codes = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const { code } = rm.createRoom(`conn-${i}`, `Host${i}`, 'medium')
      expect(codes.has(code)).toBe(false)
      codes.add(code)
    }
  })

  it('createRoom seats the host at index 0, rest default to AI', () => {
    const rm = new RoomManager()
    const { code } = rm.createRoom('conn-host', 'Host', 'medium')
    const room = rm.getRoom(code)!
    expect(room.seats).toHaveLength(4)
    expect(room.seats[0]).toMatchObject({ index: 0, kind: 'human', name: 'Host', connId: 'conn-host' })
    expect(room.seats[1].kind).toBe('ai')
    expect(room.seats[2].kind).toBe('ai')
    expect(room.seats[3].kind).toBe('ai')
    expect(room.hostId).toBe('conn-host')
  })

  it('joinRoom assigns seats in order (next free human slot)', () => {
    const rm = new RoomManager()
    const { code } = rm.createRoom('conn-host', 'Host', 'medium')
    const r1 = rm.joinRoom(code, 'conn-2', 'Bob')
    expect(r1).toEqual({ seat: 1 })
    const r2 = rm.joinRoom(code, 'conn-3', 'Carol')
    expect(r2).toEqual({ seat: 2 })
    const r3 = rm.joinRoom(code, 'conn-4', 'Dave')
    expect(r3).toEqual({ seat: 3 })
  })

  it('rejects a 5th human when room is full', () => {
    const rm = new RoomManager()
    const { code } = rm.createRoom('conn-host', 'Host', 'medium')
    rm.joinRoom(code, 'conn-2', 'Bob')
    rm.joinRoom(code, 'conn-3', 'Carol')
    rm.joinRoom(code, 'conn-4', 'Dave')
    const r = rm.joinRoom(code, 'conn-5', 'Eve')
    expect('error' in r).toBe(true)
  })

  it('rejects an invalid room code', () => {
    const rm = new RoomManager()
    const r = rm.joinRoom('ZZZZZ', 'conn-2', 'Bob')
    expect('error' in r).toBe(true)
  })

  it('startRoom only allowed by the host connection', () => {
    const rm = new RoomManager()
    const { code } = rm.createRoom('conn-host', 'Host', 'medium')
    rm.joinRoom(code, 'conn-2', 'Bob')
    const byGuest = rm.startRoom(code, 'conn-2')
    expect('error' in byGuest).toBe(true)
    const room = rm.getRoom(code)!
    expect(room.started).toBe(false)

    const byHost = rm.startRoom(code, 'conn-host')
    expect('error' in byHost).toBe(false)
    expect(room.started).toBe(true)
  })

  it('startRoom freezes 4 SeatConfigs: humans that joined + AI in the gaps', () => {
    const rm = new RoomManager()
    const { code } = rm.createRoom('conn-host', 'Host', 'hard')
    rm.joinRoom(code, 'conn-2', 'Bob')
    rm.startRoom(code, 'conn-host')
    const room = rm.getRoom(code)!
    expect(room.session).toBeDefined()
    const view = room.session!.getViewFor(0)
    expect(view.players).toHaveLength(4)
    expect(view.players[0]).toMatchObject({ seat: 0, name: 'Host', kind: 'human' })
    expect(view.players[1]).toMatchObject({ seat: 1, name: 'Bob', kind: 'human' })
    expect(view.players[2].kind).toBe('ai')
    expect(view.players[3].kind).toBe('ai')
  })

  it('leaveRoom marks disconnection without freeing the seat', () => {
    const rm = new RoomManager()
    const { code } = rm.createRoom('conn-host', 'Host', 'medium')
    rm.joinRoom(code, 'conn-2', 'Bob')
    rm.leaveRoom('conn-2')
    const room = rm.getRoom(code)!
    expect(room.seats[1].kind).toBe('human')
    expect(room.seats[1].name).toBe('Bob')
    expect(room.seats[1].connId).toBeUndefined()
  })

  it('reconnection by matching name reassumes the same seat', () => {
    const rm = new RoomManager()
    const { code } = rm.createRoom('conn-host', 'Host', 'medium')
    rm.joinRoom(code, 'conn-2', 'Bob')
    rm.leaveRoom('conn-2')

    const rejoin = rm.joinRoom(code, 'conn-2-new', 'Bob')
    expect(rejoin).toEqual({ seat: 1 })
    const room = rm.getRoom(code)!
    expect(room.seats[1].connId).toBe('conn-2-new')
  })

  it('findRoomByConn locates the room for a given connection', () => {
    const rm = new RoomManager()
    const { code } = rm.createRoom('conn-host', 'Host', 'medium')
    rm.joinRoom(code, 'conn-2', 'Bob')
    expect(rm.findRoomByConn('conn-2')?.code).toBe(code)
    expect(rm.findRoomByConn('unknown')).toBeUndefined()
  })

  describe('chooseSeat', () => {
    it('moves a guest to a different free AI seat, freeing the old one', () => {
      const rm = new RoomManager()
      const { code } = rm.createRoom('conn-host', 'Host', 'medium')
      rm.joinRoom(code, 'conn-2', 'Bob')

      const result = rm.chooseSeat(code, 'conn-2', 3)
      expect(result).toEqual({ seat: 3 })

      const room = rm.getRoom(code)!
      expect(room.seats[3]).toMatchObject({ kind: 'human', name: 'Bob', connId: 'conn-2' })
      expect(room.seats[1]).toMatchObject({ kind: 'ai', name: 'IA 2', connId: undefined })
    })

    it('escolher o próprio assento é um no-op', () => {
      const rm = new RoomManager()
      const { code } = rm.createRoom('conn-host', 'Host', 'medium')
      rm.joinRoom(code, 'conn-2', 'Bob')
      expect(rm.chooseSeat(code, 'conn-2', 1)).toEqual({ seat: 1 })
      expect(rm.getRoom(code)!.seats[1]).toMatchObject({ kind: 'human', name: 'Bob' })
    })

    it('recusa mover para um assento já ocupado por outro humano', () => {
      const rm = new RoomManager()
      const { code } = rm.createRoom('conn-host', 'Host', 'medium')
      rm.joinRoom(code, 'conn-2', 'Bob')
      rm.joinRoom(code, 'conn-3', 'Carol')
      expect(rm.chooseSeat(code, 'conn-2', 2)).toEqual({ error: expect.any(String) })
    })

    it('o anfitrião (assento 0) nunca pode trocar de assento', () => {
      const rm = new RoomManager()
      const { code } = rm.createRoom('conn-host', 'Host', 'medium')
      expect(rm.chooseSeat(code, 'conn-host', 1)).toEqual({ error: expect.any(String) })
      expect(rm.getRoom(code)!.seats[0]).toMatchObject({ kind: 'human', connId: 'conn-host' })
    })

    it('recusa depois que a partida começou', () => {
      const rm = new RoomManager()
      const { code } = rm.createRoom('conn-host', 'Host', 'medium')
      rm.joinRoom(code, 'conn-2', 'Bob')
      rm.startRoom(code, 'conn-host')
      expect(rm.chooseSeat(code, 'conn-2', 3)).toEqual({ error: expect.any(String) })
    })

    it('recusa para quem não está em nenhuma sala', () => {
      const rm = new RoomManager()
      const { code } = rm.createRoom('conn-host', 'Host', 'medium')
      expect(rm.chooseSeat(code, 'conn-desconhecido', 1)).toEqual({ error: expect.any(String) })
    })
  })

  describe('rename', () => {
    it('renomeia o assento do chamador e reflete em room.seats', () => {
      const rm = new RoomManager()
      const { code } = rm.createRoom('conn-host', 'Host', 'medium')
      rm.joinRoom(code, 'conn-2', 'Bob')
      expect(rm.rename(code, 'conn-2', 'Roberto')).toEqual({ seat: 1 })
      expect(rm.getRoom(code)!.seats[1].name).toBe('Roberto')
    })

    it('apara espaços e corta nomes muito longos', () => {
      const rm = new RoomManager()
      const { code } = rm.createRoom('conn-host', 'Host', 'medium')
      rm.rename(code, 'conn-host', '   ' + 'A'.repeat(50) + '   ')
      expect(rm.getRoom(code)!.seats[0].name).toBe('A'.repeat(24))
    })

    it('recusa nome vazio (só espaços)', () => {
      const rm = new RoomManager()
      const { code } = rm.createRoom('conn-host', 'Host', 'medium')
      expect(rm.rename(code, 'conn-host', '   ')).toEqual({ error: expect.any(String) })
      expect(rm.getRoom(code)!.seats[0].name).toBe('Host')
    })

    it('recusa depois que a partida começou (o nome exibido já está congelado no GameSession)', () => {
      const rm = new RoomManager()
      const { code } = rm.createRoom('conn-host', 'Host', 'medium')
      rm.startRoom(code, 'conn-host')
      expect(rm.rename(code, 'conn-host', 'Outro Nome')).toEqual({ error: expect.any(String) })
    })
  })
})
