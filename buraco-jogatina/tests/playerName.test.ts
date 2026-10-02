import { loadStoredPlayerName, savePlayerName } from '../src/playerName'

describe('playerName', () => {
  beforeEach(() => window.localStorage.clear())

  it('sem nome salvo devolve "Você"', () => {
    expect(loadStoredPlayerName()).toBe('Você')
  })

  it('salva e recarrega o nome', () => {
    savePlayerName('Valmir')
    expect(loadStoredPlayerName()).toBe('Valmir')
  })

  it('nome vazio volta ao padrão', () => {
    savePlayerName('')
    expect(loadStoredPlayerName()).toBe('Você')
  })

  it('localStorage indisponível não quebra nem ao ler nem ao salvar', () => {
    const getSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(loadStoredPlayerName()).toBe('Você')
    expect(() => savePlayerName('X')).not.toThrow()
    getSpy.mockRestore()
    setSpy.mockRestore()
  })
})
